import type { Command } from "commander";
import { createContext } from "../context.js";
import { printEnv } from "../../core/insight/reporter.js";

export function registerEnvCommand(program: Command): void {
  program
    .command("env")
    .description(
      "Show detected environment (runtime, package manager, framework)",
    )
    .action(async () => {
      const ctx = await createContext();
      printEnv(ctx.pm, ctx.runtime, ctx.framework);
    });
}
