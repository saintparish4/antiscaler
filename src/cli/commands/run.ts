export interface RunActionOptions {
  concurrency?: number;
}

export async function registerRunAction(
  taskName: string,
  opts: RunActionOptions = {},
): Promise<void> {
  const { createContext } = await import("../context.js");
  const { runTasksWithDeps } = await import("../../core/execution/runner.js");
  const { readCache } = await import("../../core/cache/store.js");
  const { computeInsights } = await import("../../core/insight/analyzer.js");
  const { printInsights } = await import("../../core/insight/reporter.js");

  const ctx = await createContext();
  const results = await runTasksWithDeps(taskName, ctx.graph, {
    cwd: ctx.cwd,
    cacheDir: ctx.cacheDir,
    pm: ctx.pm,
    config: ctx.config,
    tasks: ctx.config.tasks,
    ...(opts.concurrency !== undefined ? { concurrency: opts.concurrency } : {}),
  });
  const cache = readCache(ctx.cacheDir);
  printInsights(computeInsights(results, cache));
}