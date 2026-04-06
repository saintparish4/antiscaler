import pc from "picocolors";
import type { InsightSummary } from "./analyzer.js";
import type { RuntimeInfo } from "../../types/index.js";
import type { AntiscaleError } from "../errors.js";

export function printInsights(summary: InsightSummary): void {
  const isTTY = process.stdout.isTTY ?? false;
  const results = summary.lastRunResults;

  if (results.length === 0) {
    // Show historical stats from cache only
    const entries = Object.entries(summary.cachedStats);
    if (entries.length === 0) {
      console.log("No cached task data yet. Run a task first.");
      return;
    }
    console.log("\nCached task history:");
    for (const [task, entry] of entries) {
      const dur =
        entry.lastDurationMs !== undefined
          ? `${entry.lastDurationMs}ms`
          : "unknown";
      const ran = new Date(entry.lastRun).toLocaleString();
      console.log(`  ${task.padEnd(20)} last run: ${ran}  duration: ${dur}`);
    }
    return;
  }

  const maxNameLen = Math.max(...results.map((r) => r.task.length), 4);
  const col = (s: string, w: number) => s.padEnd(w);

  const header = `${col("TASK", maxNameLen)} ${"DURATION".padEnd(10)} STATUS`;
  console.log("\n" + (isTTY ? pc.bold(header) : header));
  console.log("-".repeat(header.length));

  for (const r of results) {
    const dur = r.cacheHit ? "-" : `${r.durationMs}ms`;
    const status = r.cacheHit
      ? isTTY
        ? pc.green("HIT")
        : "HIT"
      : isTTY
        ? pc.red("MISS")
        : "MISS";
    console.log(`${col(r.task, maxNameLen)} ${dur.padEnd(10)} ${status}`);
  }

  const pct = (summary.cacheHitRate * 100).toFixed(0);
  const footer = `\nTotal: ${summary.totalDurationMs}ms  Cache hit rate: ${pct}%`;
  console.log(isTTY ? pc.dim(footer) : footer);
}

export function printEnv(
  pm: string,
  runtime: RuntimeInfo,
  framework: string | null,
): void {
  console.log(`Package Manager : ${pm}`);
  console.log(
    `Runtime         : ${runtime.primary} (fallback: ${runtime.fallback})`,
  );
  console.log(`Framework       : ${framework ?? "none detected"}`);
}

export function printError(err: AntiscaleError): void {
  const isTTY = process.stdout.isTTY ?? false;
  const prefix = `[${err.code}]`;
  console.error(
    isTTY ? `${pc.red(prefix)} ${err.message}` : `${prefix} ${err.message}`,
  );
}
