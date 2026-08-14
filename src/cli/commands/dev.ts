import { createContext, toRunOptions } from "../context.js";
import { executeTarget } from "../execute.js";
import { renderDryRunPlan } from "../render/plan.js";

export interface DevActionOptions {
	concurrency?: number;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerDevAction(
	opts: DevActionOptions = {},
): Promise<void> {
	const ctx = await createContext();

	if (opts.dryRun) {
		renderDryRunPlan("dev", ctx.graph.toLevels("dev"));
		return;
	}

	await executeTarget(
		"dev",
		ctx,
		toRunOptions(ctx, opts),
		"Running dev tasks...",
	);
}
