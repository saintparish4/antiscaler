import type { Command } from "commander";

export async function registerBuildAction(): Promise<void> {
  const { createContext } = await import("../context.js");
  const { runTasksWithDeps } = await import("../../core/execution/runner.js");
  const { readCache } = await import("../../core/cache/store.js");
  const { computeInsights } = await import("../../core/insight/analyzer.js");
  const { printInsights } = await import("../../core/insight/reporter.js");

  const ctx = await createContext();
  const results = await runTasksWithDeps("build", ctx.graph, {
    cwd: ctx.cwd,
    cacheDir: ctx.cacheDir,
    pm: ctx.pm,
    config: ctx.config,
    tasks: ctx.config.tasks,
  });
  const cache = readCache(ctx.cacheDir);
  printInsights(computeInsights(results, cache));
}

// Legacy registration kept for backward compat; not used by lazy index.ts
export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Run the build task")
    .action(registerBuildAction);
}
