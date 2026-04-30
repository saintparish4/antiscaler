#!/usr/bin/env node
import { Command } from "commander";
import { AntiscaleError, CliUsageError } from "../core/errors.js";

interface ConcurrencyOpts {
  concurrency?: string;
}

function parseConcurrency(opts: ConcurrencyOpts): number | undefined {
  if (opts.concurrency === undefined) return undefined;
  const n = Number.parseInt(opts.concurrency, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new CliUsageError(
      `--concurrency must be a positive integer, got "${opts.concurrency}"`,
    );
  }
  return n;
}

const program = new Command()
  .name("antiscaler")
  .description("Adaptive dev orchestration CLI")
  .version("0.1.3");

program
  .command("build")
  .description("Run the build task")
  .option(
    "-c, --concurrency <n>",
    "max tasks to run concurrently per DAG level",
  )
  .action(async (opts: ConcurrencyOpts) => {
    const { registerBuildAction } = await import("./commands/build.js");
    const concurrency = parseConcurrency(opts);
    await registerBuildAction(concurrency !== undefined ? { concurrency } : {});
  });

program
  .command("dev")
  .description("Start the dev server")
  .option(
    "-c, --concurrency <n>",
    "max tasks to run concurrently per DAG level",
  )
  .action(async (opts: ConcurrencyOpts) => {
    const { registerDevAction } = await import("./commands/dev.js");
    const concurrency = parseConcurrency(opts);
    await registerDevAction(concurrency !== undefined ? { concurrency } : {});
  });

program
  .command("run <task>")
  .description("Run a named task")
  .option(
    "-c, --concurrency <n>",
    "max tasks to run concurrently per DAG level",
  )
  .action(async (taskName: string, opts: ConcurrencyOpts) => {
    const { registerRunAction } = await import("./commands/run.js");
    const concurrency = parseConcurrency(opts);
    await registerRunAction(
      taskName,
      concurrency !== undefined ? { concurrency } : {},
    );
  });

program
  .command("init")
  .description("Scaffold antiscale.config.ts in the current directory")
  .action(async () => {
    const { registerInitAction } = await import("./commands/init.js");
    await registerInitAction();
  });

program
  .command("insight")
  .description("Show task timing and cache hit stats")
  .action(async () => {
    const { registerInsightAction } = await import("./commands/insight.js");
    await registerInsightAction();
  });

program
  .command("env")
  .description(
    "Show detected environment (runtime, package manager, framework)",
  )
  .action(async () => {
    const { registerEnvAction } = await import("./commands/env.js");
    await registerEnvAction();
  });

program
  .command("check")
  .description("Validate config and task graph (no execution)")
  .action(async () => {
    const { registerCheckAction } = await import("./commands/check.js");
    await registerCheckAction();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof AntiscaleError) {
    console.error(`[${err.code}] ${err.message}`);
    process.exit(1);
  }
  console.error("Unexpected error — please file a bug:", err);
  process.exit(2);
});
