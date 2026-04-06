import type { TaskConfig } from "../../types/index.js";
import { TaskExecutionError } from "../errors.js";

export type TaskExecutor = (
  name: string,
  cfg: TaskConfig,
  pm: string,
  cwd: string,
) => Promise<void>;

export const executeTask: TaskExecutor = async (name, cfg, pm, cwd) => {
  // Lazy import — keeps startup fast (antiscale --help stays < 100ms)
  const { execa } = await import("execa");

  const command = cfg.command ?? `${pm} run ${name}`;
  const [cmd, ...args] = command.split(" ");

  if (!cmd) {
    throw new TaskExecutionError(name, 1, `Empty command for task "${name}"`);
  }

  try {
    await execa(cmd, args, { cwd, stdio: "inherit" });
  } catch (err: unknown) {
    const exitCode =
      err !== null &&
      typeof err === "object" &&
      "exitCode" in err &&
      typeof (err as { exitCode: unknown }).exitCode === "number"
        ? (err as { exitCode: number }).exitCode
        : 1;
    throw new TaskExecutionError(name, exitCode);
  }
};
