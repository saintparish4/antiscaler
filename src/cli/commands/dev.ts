export interface DevActionOptions {
	concurrency?: number;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerDevAction(
	opts: DevActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");

	const ctx = await createContext();

	if (opts.dryRun) {
		const levels = ctx.graph.toLevels("dev");
		console.log(
			`[dry-run] Task plan for "dev" (${levels.flat().length} task(s)):`,
		);
		for (const [i, level] of levels.entries()) {
			console.log(`  Level ${i + 1}: ${level.join(", ")}`);
		}
		return;
	}

	const { runTasksWithDeps } = await import("../../core/execution/runner.js");
	const { createTaskEventProgress } = await import("../visuals/task-events.js");

	const runOptions = toRunOptions(ctx, opts);
	const progress = createTaskEventProgress("Running dev tasks...");
	runOptions.onTaskEvent = progress.onTaskEvent;
	if (progress.onTaskOutput !== undefined) {
		runOptions.onTaskOutput = progress.onTaskOutput;
	}

	try {
		await runTasksWithDeps("dev", ctx.graph, runOptions);
	} finally {
		progress.finish();
	}
}
