export class AntiscaleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AntiscaleError";
  }
}

export class ConfigError extends AntiscaleError {
  constructor(message: string) {
    super("CONFIG_ERROR", message);
  }
}

export class CycleError extends AntiscaleError {
  constructor(public cycle: string[]) {
    super("CYCLE_ERROR", `Circular dependency detected: ${cycle.join(" -> ")}`);
  }
}

export class TaskExecutionError extends AntiscaleError {
  constructor(
    public task: string,
    public exitCode: number,
    message?: string,
  ) {
    super(
      "TASK_EXECUTION_ERROR",
      message ?? `Task "${task}" failed with exit code ${exitCode}`,
    );
  }
}

export class CacheError extends AntiscaleError {
  constructor(message: string) {
    super("CACHE_ERROR", message);
  }
}
