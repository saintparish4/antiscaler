import type { TaskConfig, ResolvedAntiscaleConfig } from "../../types/index.js";
import { TaskGraph } from "../graph/dag.js";
import { readCache, writeCache } from "../cache/store.js";
import { hashTaskInputs } from "../cache/hashing.js";
import { executeTask, type TaskExecutor } from "./executor.js";

export interface RunOptions {
  cwd: string;
  cacheDir: string;
  pm: string;
  config: ResolvedAntiscaleConfig;
  tasks: Record<string, TaskConfig>;
}

export interface TaskRunResult {
  task: string;
  durationMs: number;
  cacheHit: boolean;
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

  // Safety net: write cache even on unexpected exit
  const flushCache = () => writeCache(options.cacheDir, cache);
  process.on("exit", flushCache);

  try {
    for (const level of levels) {
      const levelResults = await Promise.all(
        level.map(async (taskName): Promise<TaskRunResult> => {
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

          // No inputs or strict mode: always execute
          const start = Date.now();
          await executor(taskName, taskCfg, options.pm, options.cwd);
          const durationMs = Date.now() - start;

          return { task: taskName, durationMs, cacheHit: false };
        }),
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
