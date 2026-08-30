// Imported from the leaf module rather than the `types/` barrel, which reaches
// back into core and would make this a cycle.
import type { TaskProvenance } from "../types/provenance.js";

export class LinkctlError extends Error {
	hint?: string;
	/**
	 * Why the task that produced this failure was running. Attached by the
	 * runner so the failure and its reason travel together; absent on errors
	 * belonging to no task (config, CLI usage) and on successful runs.
	 *
	 * This says nothing about why the task FAILED — see `RunReason`.
	 */
	provenance?: TaskProvenance;
	constructor(
		public code: string,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "LinkctlError";
	}
}

export class ConfigError extends LinkctlError {
	constructor(message: string, options?: ErrorOptions) {
		super("CONFIG_ERROR", message, options);
		this.hint = "Run `linkctl doctor` to diagnose configuration issues.";
	}
}

export class CycleError extends LinkctlError {
	constructor(public cycle: string[]) {
		super("CYCLE_ERROR", `Circular dependency detected: ${cycle.join(" -> ")}`);
		this.hint = "Remove or reorder `dependsOn` entries to break the cycle.";
	}
}

export class TaskExecutionError extends LinkctlError {
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

export class CacheError extends LinkctlError {
	constructor(message: string, options?: ErrorOptions) {
		super("CACHE_ERROR", message, options);
		this.hint = "Delete `.linkctl/cache/` and retry.";
	}
}

export class GraphError extends LinkctlError {
	constructor(message: string, options?: ErrorOptions) {
		super("GRAPH_ERROR", message, options);
		this.hint = "Delete `.linkctl/graph/` and retry.";
	}
}

export class CliUsageError extends LinkctlError {
	constructor(message: string) {
		super("CLI_USAGE", message);
		this.hint = "Run `linkctl --help` for usage information.";
	}
}
