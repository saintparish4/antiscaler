import { Command } from "commander";
import { AntiscaleError } from "../core/errors.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerDevCommand } from "./commands/dev.js";
import { registerRunCommand } from "./commands/run.js";
import { registerInitCommand } from "./commands/init.js";
import { registerInsightCommand } from "./commands/insight.js";
import { registerEnvCommand } from "./commands/env.js";
import { registerCheckCommand } from "./commands/check.js";

const program = new Command()
  .name("antiscale")
  .description("Adaptive dev orchestration CLI")
  .version("0.1.0");

registerBuildCommand(program);
registerDevCommand(program);
registerRunCommand(program);
registerInitCommand(program);
registerInsightCommand(program);
registerEnvCommand(program);
registerCheckCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof AntiscaleError) {
    console.error(`[${err.code}] ${err.message}`);
    process.exit(1);
  }
  console.error("Unexpected error — please file a bug:", err);
  process.exit(2);
});
