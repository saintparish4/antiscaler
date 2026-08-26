export class LinkError extends Error {
	hint?: string;
	constructor(
		public code: string,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "LinkError";
	}
}

export class ConfigError extends LinkError {
	constructor(message: string, options?: ErrorOptions) {
		super("CONFIG_ERROR", message, options);
		this.hint = "Run `link doctor` to diagnose configuration issues.";
	}
}

export class CycleError extends LinkError {
	constructor(public cycle: string[]) {
		super("CYCLE_ERROR", `Circular dependency detected: ${cycle.join(" -> ")}`);
		this.hint = "Remove or reorder `dependsOn` entries to break the cycle.";
	}
}

export class TaskExecutionError extends LinkError {
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

export class CacheError extends LinkError {
	constructor(message: string, options?: ErrorOptions) {
		super("CACHE_ERROR", message, options);
		this.hint = "Delete `.link/cache/` and retry.";
	}
}

export class GraphError extends LinkError {
	constructor(message: string, options?: ErrorOptions) {
		super("GRAPH_ERROR", message, options);
		this.hint = "Delete `.link/graph/` and retry.";
	}
}

export class CliUsageError extends LinkError {
	constructor(message: string) {
		super("CLI_USAGE", message);
		this.hint = "Run `link --help` for usage information.";
	}
}
