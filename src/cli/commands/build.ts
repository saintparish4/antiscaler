import {
	affectedTaskFilter,
	bothFilters,
	tracedPackagePriority,
} from "../../core/scope/task-filter.js";
import { tracedPackagesForSession } from "../../core/scope/trace-scope.js";
import { createContext, toRunOptions } from "../context.js";
import { executeTarget, reportRunInsights } from "../execute.js";
import { renderDryRunPlan } from "../render/plan.js";

export interface BuildActionOptions {
	concurrency?: number;
	/** Trace session whose packages should be built first. */
	scope?: string;
	/** Only run tasks for packages the current git diff affects (with cascade dependents). */
	affected?: boolean;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerBuildAction(
	opts: BuildActionOptions = {},
): Promise<void> {
	const ctx = await createContext();

	if (opts.dryRun) {
		renderDryRunPlan("build", ctx.graph.toLevels("build"));
		return;
	}

	const runOptions = toRunOptions(ctx, opts);

	if (opts.scope) {
		const traced = await tracedPackagesForSession(ctx.cwd, opts.scope);
		runOptions.priorityOf = tracedPackagePriority(traced);
		runOptions.useScheduler = true;
	}

	if (opts.affected && ctx.affectedPackages !== undefined) {
		runOptions.taskFilter = bothFilters(
			runOptions.taskFilter,
			affectedTaskFilter(ctx.affectedPackages),
		);
	}

	const results = await executeTarget(
		"build",
		ctx,
		runOptions,
		"Running build tasks...",
	);
	await reportRunInsights(ctx, results);
}
