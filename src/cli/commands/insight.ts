import type { Command } from "commander";

export async function registerInsightAction(): Promise<void> {
  const { createContext } = await import("../context.js");
  const { readCache } = await import("../../core/cache/store.js");
  const { computeInsights } = await import("../../core/insight/analyzer.js");
  const { printInsights } = await import("../../core/insight/reporter.js");

  const ctx = await createContext();
  const cache = readCache(ctx.cacheDir);
  printInsights(computeInsights([], cache));
}

export function registerInsightCommand(program: Command): void {
  program
    .command("insight")
    .description("Show task timing and cache hit stats")
    .action(registerInsightAction);
}
