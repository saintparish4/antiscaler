import type { TaskRunResult } from "../../core/execution/runner.js";

export interface RunActionOptions {
	concurrency?: number;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerRunAction(
	taskName: string,
	opts: RunActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");

	const ctx = await createContext();

	if (opts.dryRun) {
		const levels = ctx.graph.toLevels(taskName);
		console.log(
			`[dry-run] Task plan for "${taskName}" (${levels.flat().length} task(s)):`,
		);
		for (const [i, level] of levels.entries()) {
			console.log(`  Level ${i + 1}: ${level.join(", ")}`);
		}
		return;
	}

	const { runTasksWithDeps } = await import("../../core/execution/runner.js");
	const { readCache } = await import("../../core/cache/store.js");
	const { computeInsights } = await import("../../core/insight/analyzer.js");
	const { printInsights } = await import("../../core/insight/reporter.js");
	const { createTaskEventProgress } = await import("../visuals/task-events.js");

	const runOptions = toRunOptions(ctx, opts);
	const progress = createTaskEventProgress(`Running ${taskName} tasks...`);
	runOptions.onTaskEvent = progress.onTaskEvent;
	if (progress.onTaskOutput !== undefined) {
		runOptions.onTaskOutput = progress.onTaskOutput;
	}

	let results: TaskRunResult[];
	try {
		results = await runTasksWithDeps(taskName, ctx.graph, runOptions);
	} finally {
		progress.finish();
	}
	const cache = await readCache(ctx.cacheDir);
	printInsights(
		computeInsights(results, cache, ctx.config.cache.costPerMissMs),
	);
}
