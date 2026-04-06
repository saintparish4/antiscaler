import type { Command } from "commander";
import { createContext } from "../context.js";
import { ConfigError } from "../../core/errors.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Validate config and task graph (no execution)")
    .action(async () => {
      const ctx = await createContext();

      // 1. All dependsOn references must point to known tasks
      for (const [name, task] of Object.entries(ctx.config.tasks)) {
        for (const dep of task.dependsOn ?? []) {
          if (!(dep in ctx.config.tasks)) {
            throw new ConfigError(
              `Task "${name}" depends on unknown task "${dep}"`,
            );
          }
        }
      }

      // 2. No cycles — toLevels throws CycleError if one is found
      for (const name of Object.keys(ctx.config.tasks)) {
        ctx.graph.toLevels(name);
      }

      console.log("Config and graph are valid.");
    });
}
