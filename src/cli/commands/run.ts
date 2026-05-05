export interface RunActionOptions {
	concurrency?: number;
}

export async function registerRunAction(
	taskName: string,
	opts: RunActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");
	const { runTasksWithDeps } = await import("../../core/execution/runner.js");
	const { readCache } = await import("../../core/cache/store.js");
	const { computeInsights } = await import("../../core/insight/analyzer.js");
	const { printInsights } = await import("../../core/insight/reporter.js");

	const ctx = await createContext();
	const results = await runTasksWithDeps(
		taskName,
		ctx.graph,
		toRunOptions(ctx, opts),
	);
	const cache = await readCache(ctx.cacheDir);
	printInsights(computeInsights(results, cache));
}
