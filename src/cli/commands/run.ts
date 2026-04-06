import type { Command } from "commander";
import { createContext } from "../context.js";
import { runTasksWithDeps } from "../../core/execution/runner.js";
import { readCache } from "../../core/cache/store.js";
import { computeInsights } from "../../core/insight/analyzer.js";
import { printInsights } from "../../core/insight/reporter.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run <task>")
    .description("Run a named task")
    .action(async (taskName: string) => {
      const ctx = await createContext();
      const results = await runTasksWithDeps(taskName, ctx.graph, {
        cwd: ctx.cwd,
        cacheDir: ctx.cacheDir,
        pm: ctx.pm,
        config: ctx.config,
        tasks: ctx.config.tasks,
      });
      const cache = readCache(ctx.cacheDir);
      printInsights(computeInsights(results, cache));
    });
}
