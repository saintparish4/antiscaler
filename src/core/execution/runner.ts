import { createHash } from "node:crypto";
import os from "node:os";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

import type {
  TaskConfig,
  ResolvedAntiscaleConfig,
  TaskGraph,
} from "../../types/index.js";
import {
  readCache,
  writeCache,
  writeCacheSync,
  type CacheFile,
} from "../cache/store.js";
import { hashTaskInputs } from "../cache/hashing.js";
import { executeTask, type TaskExecutor } from "./executor.js";
import { runScheduled } from "./scheduler.js";
import type { PluginRegistry } from "../plugins/registry.js";

export interface RunOptions {
  cwd: string;
  cacheDir: string;
  pm: string;
  config: ResolvedAntiscaleConfig;
  tasks: Record<string, TaskConfig>;
  concurrency?: number;
  /** When true, use event-driven scheduling instead of level-based waves. */
  useScheduler?: boolean;
  /** Lower priority runs sooner (passed through to the scheduler). */
  priorityOf?: (task: string) => number;
  // Optional plugin registry. Defaults to an empty registry.
  plugins: PluginRegistry;
  /** When set, hashTaskInputs only reads files inside these dirs. */
  packageScopes?: string[];
}

export interface TaskRunResult {
  task: string;
  durationMs: number;
  cacheHit: boolean;
}

export function defaultConcurrency(): number {
  return Math.max(1, os.cpus().length - 1);
}

/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 * Preserves input order in the result array.
 *
 * stopOnError (default true): when any `fn` rejects, no NEW items are
 * picked up. Already-in-flight items finish; the first rejection is
 * re-thrown after every in-flight worker has settled. This avoids
 * killing processes mid-execution while still saving work on doomed runs.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  stopOnError = true,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  let firstError: unknown = null;
  let stopped = false;

  const worker = async (): Promise<void> => {
    while (true) {
      if (stopped) return;
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i] as T, i);
      } catch (err) {
        if (firstError === null) firstError = err;
        if (stopOnError) stopped = true;
        return;
      }
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  if (firstError !== null) throw firstError;
  return results;
}

async function runOneTask(
  taskName: string,
  options: RunOptions,
  cache: CacheFile,
  executor: TaskExecutor,
): Promise<TaskRunResult> {
  const taskCfg = options.tasks[taskName] ?? {};
  const patterns = taskCfg.inputs ?? [];
  const isStrict = options.config.strategy === "strict";
  const plugins = options.plugins;

  if (plugins) {
    const skip = await plugins.runOnBeforeExecute(taskName);
    if (skip) {
      const result: TaskRunResult = {
        task: taskName,
        durationMs: 0,
        cacheHit: true,
      };
      await plugins.runOnAfterExecute(taskName, result);
      return result;
    }
  }

  if (!isStrict && patterns.length > 0) {
    const baseHash = await hashTaskInputs(
      options.cwd,
      patterns,
      options.packageScopes !== undefined
        ? { packageScopes: options.packageScopes }
        : {},
    );
    const extra = plugins ? await plugins.runOnHash(taskName, patterns) : [];
    const hash =
      extra.length === 0
        ? baseHash
        : sha256(baseHash + "\x00" + extra.join("\x00"));
    const cached = cache.tasks[taskName];

    if (cached !== undefined && cached.hash === hash) {
      const result: TaskRunResult = {
        task: taskName,
        durationMs: 0,
        cacheHit: true,
      };
      if (plugins) await plugins.runOnAfterExecute(taskName, result);
      return result;
    }

    const start = Date.now();
    await executor(taskName, taskCfg, options.pm, options.cwd);
    const durationMs = Date.now() - start;

    cache.tasks[taskName] = {
      hash,
      lastRun: Date.now(),
      lastDurationMs: durationMs,
    };

    const result: TaskRunResult = {
      task: taskName,
      durationMs,
      cacheHit: false,
    };
    if (plugins) await plugins.runOnAfterExecute(taskName, result);
    return result;
  }

  // Strict mode or no-inputs task: always execute, but still
  // record run metadata so `insight` shows history for these tasks.
  const start = Date.now();
  await executor(taskName, taskCfg, options.pm, options.cwd);
  const durationMs = Date.now() - start;

  cache.tasks[taskName] = {
    lastRun: Date.now(),
    lastDurationMs: durationMs,
  };

  const result: TaskRunResult = {
    task: taskName,
    durationMs,
    cacheHit: false,
  };
  if (plugins) await plugins.runOnAfterExecute(taskName, result);
  return result;
}

export async function runTasksWithDeps(
  target: string,
  graph: TaskGraph,
  options: RunOptions,
  executor: TaskExecutor = executeTask,
): Promise<TaskRunResult[]> {
  const levels = graph.toLevels(target);
  const cache: CacheFile = await readCache(options.cacheDir);
  const results: TaskRunResult[] = [];
  const concurrency = options.concurrency ?? defaultConcurrency();

  // Defense-in-depth: if the process is killed mid-run (SIGINT, etc.) we
  // still flush whatever we have. The handler MUST be synchronous.
  const flushCache = (): void => writeCacheSync(options.cacheDir, cache);
  process.on("exit", flushCache);

  try {
    if (options.useScheduler) {
      const byTask = new Map<string, TaskRunResult>();
      await runScheduled(
        target,
        graph,
        async (taskName) => {
          byTask.set(
            taskName,
            await runOneTask(taskName, options, cache, executor),
          );
        },
        {
          concurrency,
          ...(options.priorityOf !== undefined
            ? { priorityOf: options.priorityOf }
            : {}),
        },
      );
      for (const name of levels.flat()) {
        const r = byTask.get(name);
        if (r !== undefined) results.push(r);
      }
    } else {
      for (const level of levels) {
        const levelResults = await mapLimit(
          level,
          concurrency,
          async (taskName): Promise<TaskRunResult> =>
            runOneTask(taskName, options, cache, executor),
        );

        results.push(...levelResults);
      }
    }
  } finally {
    // ALWAYS persist whatever we have, even on task failure.
    // Order matters: write first, then remove the exit handler so the
    // safety net is still armed during the await.
    try {
      await writeCache(options.cacheDir, cache);
    } catch {
      // If async write fails, fall back to the sync handler logic --
      // the exit handler will still run on process termination.
    }
    process.off("exit", flushCache);
  }

  return results;
}
