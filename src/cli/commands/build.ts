export interface BuildActionOptions {
	concurrency?: number;
	scope?: string;
}

export async function registerBuildAction(
	opts: BuildActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");
	const { runTasksWithDeps } = await import("../../core/execution/runner.js");
	const { loadPackageGraph } = await import(
		"../../core/graph/package-graph.js"
	);
	const { readCache } = await import("../../core/cache/store.js");
	const { computeInsights } = await import("../../core/insight/analyzer.js");
	const { printInsights } = await import("../../core/insight/reporter.js");
	const { loadTrace, tracedPackages } = await import(
		"../../core/scope/trace-loader.js"
	);

	const ctx = await createContext();
	const runOptions = toRunOptions(ctx, opts);

	if (opts.scope) {
		const trace = await loadTrace(ctx.cwd, opts.scope);
		const pkgGraph = await loadPackageGraph(ctx.cwd);
		const traced = tracedPackages(trace, pkgGraph);
		runOptions.priorityOf = (taskName) => {
			const pkg = taskName.split(":")[0];
			return traced.has(pkg ?? "") ? 0 : Number.POSITIVE_INFINITY;
		};
		runOptions.useScheduler = true;
	}

	const results = await runTasksWithDeps("build", ctx.graph, runOptions);
	const cache = await readCache(ctx.cacheDir);
	printInsights(computeInsights(results, cache));
}
