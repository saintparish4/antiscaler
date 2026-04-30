import type { TaskConfig } from "../../types/index.js";
import { TaskExecutionError } from "../errors.js";

export type TaskExecutor = (
  name: string,
  cfg: TaskConfig,
  pm: string,
  cwd: string,
) => Promise<void>;

export const executeTask: TaskExecutor = async (name, cfg, pm, cwd) => {
  // Lazy imports keep startup fast (`antiscaler --help` stays < 100ms).
  const { execa, ExecaError } = await import("execa");
  const { default: stringArgv } = await import("string-argv");

  const command = cfg.command ?? `${pm} run ${name}`;
  const [cmd, ...args] = stringArgv(command);

  if (!cmd) {
    throw new TaskExecutionError(name, 1, `Empty command for task "${name}"`);
  }

  try {
    await execa(cmd, args, { cwd, stdio: "inherit" });
  } catch (err: unknown) {
    if (err instanceof ExecaError) {
      const exitCode = typeof err.exitCode === "number" ? err.exitCode : 1;
      const signal = typeof err.signal === "string" ? err.signal : null;
      const message = signal
        ? `Task "${name}" killed by ${signal}`
        : `Task "${name}" failed with exit code ${exitCode}`;
      throw new TaskExecutionError(name, exitCode, message, { cause: err });
    }
    // Non-execa error (rare: spawn failure, etc.). Preserve cause anyway.
    throw new TaskExecutionError(
      name,
      1,
      `Task "${name}" failed: ${String(err)}`,
      { cause: err },
    );
  }
};
