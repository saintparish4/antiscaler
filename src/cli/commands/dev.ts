import type { Command } from "commander";

export async function registerDevAction(): Promise<void> {
  const { createContext } = await import("../context.js");
  const { runTasksWithDeps } = await import("../../core/execution/runner.js");

  const ctx = await createContext();
  await runTasksWithDeps("dev", ctx.graph, {
    cwd: ctx.cwd,
    cacheDir: ctx.cacheDir,
    pm: ctx.pm,
    config: ctx.config,
    tasks: ctx.config.tasks,
  });
}

export function registerDevCommand(program: Command): void {
  program
    .command("dev")
    .description("Start the dev server")
    .action(registerDevAction);
}
