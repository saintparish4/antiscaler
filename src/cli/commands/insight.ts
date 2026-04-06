import type { Command } from "commander";
import { createContext } from "../context.js";
import { readCache } from "../../core/cache/store.js";
import { computeInsights } from "../../core/insight/analyzer.js";
import { printInsights } from "../../core/insight/reporter.js";

export function registerInsightCommand(program: Command): void {
  program
    .command("insight")
    .description("Show task timing and cache hit stats")
    .action(async () => {
      const ctx = await createContext();
      const cache = readCache(ctx.cacheDir);
      // Pass empty results — reporter falls back to historical cache stats
      printInsights(computeInsights([], cache));
    });
}
