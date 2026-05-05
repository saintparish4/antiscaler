export class AntiscaleError extends Error {
	constructor(
		public code: string,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "AntiscaleError";
	}
}

export class ConfigError extends AntiscaleError {
	constructor(message: string, options?: ErrorOptions) {
		super("CONFIG_ERROR", message, options);
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
		options?: ErrorOptions,
	) {
		super(
			"TASK_EXECUTION_ERROR",
			message ?? `Task "${task}" failed with exit code ${exitCode}`,
			options,
		);
	}
}

export class CacheError extends AntiscaleError {
	constructor(message: string, options?: ErrorOptions) {
		super("CACHE_ERROR", message, options);
	}
}

export class CliUsageError extends AntiscaleError {
	constructor(message: string) {
		super("CLI_USAGE", message);
	}
}
