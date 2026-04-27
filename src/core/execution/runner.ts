import os from "node:os";
import type {
  TaskConfig,
  ResolvedAntiscaleConfig,
  TaskGraph,
} from "../../types/index.js";
import { readCache, writeCache } from "../cache/store.js";
import { hashTaskInputs } from "../cache/hashing.js";
import { executeTask, type TaskExecutor } from "./executor.js";

export interface RunOptions {
  cwd: string;
  cacheDir: string;
  pm: string;
  config: ResolvedAntiscaleConfig;
  tasks: Record<string, TaskConfig>;
  /** Max tasks to run concurrently inside a single DAG level */
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
 * Preserves input order in the result array. Tiny on purpose — we don't
 * need cancellation, priorities, or backpressure for a build runner.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  };
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

export async function runTasksWithDeps(
  target: string,
  graph: TaskGraph,
  options: RunOptions,
  executor: TaskExecutor = executeTask,
): Promise<TaskRunResult[]> {
  const levels = graph.toLevels(target);
  const cache = readCache(options.cacheDir);
  const results: TaskRunResult[] = [];
  const concurrency = options.concurrency ?? defaultConcurrency();

  // Safety net: write cache even on unexpected exit
  const flushCache = (): void => writeCache(options.cacheDir, cache);
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

          // Strict mode or no-inputs task: always execute, but still record
          // run metadata so `insight` shows history for these tasks.
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
    process.off("exit", flushCache);
  }

  // Batch write once after all tasks complete
  writeCache(options.cacheDir, cache);

  return results;
}
