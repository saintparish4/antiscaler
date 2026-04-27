export interface DevActionOptions {
  concurrency?: number;
}

export async function registerDevAction(
  opts: DevActionOptions = {},
): Promise<void> {
  const { createContext } = await import("../context.js");
  const { runTasksWithDeps } = await import("../../core/execution/runner.js");

  const ctx = await createContext();
  await runTasksWithDeps("dev", ctx.graph, {
    cwd: ctx.cwd,
    cacheDir: ctx.cacheDir,
    pm: ctx.pm,
    config: ctx.config,
    tasks: ctx.config.tasks,
    ...(opts.concurrency !== undefined ? { concurrency: opts.concurrency } : {}),
  });
}