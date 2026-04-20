#!/usr/bin/env node
import { Command } from "commander";
import { AntiscaleError } from "../core/errors.js";

const program = new Command()
  .name("antiscaler")
  .description("Adaptive dev orchestration CLI")
  .version("0.1.0");

program
  .command("build")
  .description("Run the build task")
  .action(async () => {
    const { registerBuildAction } = await import("./commands/build.js");
    await registerBuildAction();
  });

program
  .command("dev")
  .description("Start the dev server")
  .action(async () => {
    const { registerDevAction } = await import("./commands/dev.js");
    await registerDevAction();
  });

program
  .command("run <task>")
  .description("Run a named task")
  .action(async (taskName: string) => {
    const { registerRunAction } = await import("./commands/run.js");
    await registerRunAction(taskName);
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
