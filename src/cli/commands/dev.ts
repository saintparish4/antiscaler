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
	const { createProgressReporter } = await import(
		"../../core/progress/reporter.js"
	);

	const runOptions = toRunOptions(ctx, opts);
	runOptions.onTaskEvent = createProgressReporter();

	await runTasksWithDeps("dev", ctx.graph, runOptions);
}
