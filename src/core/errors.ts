export class AntiscaleError extends Error {
	hint?: string;
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
		this.hint = "Run `antiscaler doctor` to diagnose configuration issues.";
	}
}

export class CycleError extends AntiscaleError {
	constructor(public cycle: string[]) {
		super("CYCLE_ERROR", `Circular dependency detected: ${cycle.join(" -> ")}`);
		this.hint = "Remove or reorder `dependsOn` entries to break the cycle.";
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
		this.hint = `Check the output above, fix the failing command in task "${task}", then re-run.`;
	}
}

export class CacheError extends AntiscaleError {
	constructor(message: string, options?: ErrorOptions) {
		super("CACHE_ERROR", message, options);
		this.hint = "Delete `.antiscale/cache/` and retry.";
	}
}

export class CliUsageError extends AntiscaleError {
	constructor(message: string) {
		super("CLI_USAGE", message);
		this.hint = "Run `antiscaler --help` for usage information.";
	}
}
