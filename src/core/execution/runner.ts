import os from "node:os";
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

export interface RunOptions {
  cwd: string;
  cacheDir: string;
  pm: string;
  config: ResolvedAntiscaleConfig;
  tasks: Record<string, TaskConfig>;
  // Max tasks to run concurrently inside a single DAG level.
  concurrency?: number;
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
    for (const level of levels) {
      const levelResults = await mapLimit(
        level,
        concurrency,
        async (taskName): Promise<TaskRunResult> => {
          const taskCfg = options.tasks[taskName] ?? {};
          const patterns = taskCfg.inputs ?? [];
          const isStrict = options.config.strategy === "strict";

          if (!isStrict && patterns.length > 0) {
            const hash = await hashTaskInputs(options.cwd, patterns);
            const cached = cache.tasks[taskName];

            if (cached !== undefined && cached.hash === hash) {
              return { task: taskName, durationMs: 0, cacheHit: true };
            }

            const start = Date.now();
            await executor(taskName, taskCfg, options.pm, options.cwd);
            const durationMs = Date.now() - start;

            cache.tasks[taskName] = {
              hash,
              lastRun: Date.now(),
              lastDurationMs: durationMs,
            };

            return { task: taskName, durationMs, cacheHit: false };
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

          return { task: taskName, durationMs, cacheHit: false };
        },
      );

      results.push(...levelResults);
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
