import { createContext, toRunOptions } from "../context.js";
import { executeTarget, reportRunInsights } from "../execute.js";
import { renderDryRunPlan } from "../render/plan.js";

export interface RunActionOptions {
	concurrency?: number;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerRunAction(
	taskName: string,
	opts: RunActionOptions = {},
): Promise<void> {
	const ctx = await createContext();

	if (opts.dryRun) {
		renderDryRunPlan(taskName, ctx.graph.toLevels(taskName));
		return;
	}

	const results = await executeTarget(
		taskName,
		ctx,
		toRunOptions(ctx, opts),
		`Running ${taskName} tasks...`,
	);
	await reportRunInsights(ctx, results);
}
