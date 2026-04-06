import type { Command } from "commander";
import { createContext } from "../context.js";
import { runTasksWithDeps } from "../../core/execution/runner.js";

export function registerDevCommand(program: Command): void {
  program
    .command("dev")
    .description("Start the dev server")
    .action(async () => {
      const ctx = await createContext();
      // Falls through to executor which uses `${pm} run dev` if no command set
      await runTasksWithDeps("dev", ctx.graph, {
        cwd: ctx.cwd,
        cacheDir: ctx.cacheDir,
        pm: ctx.pm,
        config: ctx.config,
        tasks: ctx.config.tasks,
      });
    });
}
