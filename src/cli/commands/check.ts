import type { Command } from "commander";

export async function registerCheckAction(): Promise<void> {
  const { createContext } = await import("../context.js");
  const { ConfigError } = await import("../../core/errors.js");

  const ctx = await createContext();

  for (const [name, task] of Object.entries(ctx.config.tasks)) {
    for (const dep of task.dependsOn ?? []) {
      if (!(dep in ctx.config.tasks)) {
        throw new ConfigError(
          `Task "${name}" depends on unknown task "${dep}"`,
        );
      }
    }
  }

  for (const name of Object.keys(ctx.config.tasks)) {
    ctx.graph.toLevels(name);
  }

  console.log("Config and graph are valid.");
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Validate config and task graph (no execution)")
    .action(registerCheckAction);
}
