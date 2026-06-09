export interface BuildActionOptions {
	concurrency?: number;
	scope?: string;
	/** When true, only run tasks for packages affected by the current git diff (including cascade dependents). */
	affected?: boolean;
	/** Print the task plan without executing anything. */
	dryRun?: boolean;
}

export async function registerBuildAction(
	opts: BuildActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");

	const ctx = await createContext();

	if (opts.dryRun) {
		const levels = ctx.graph.toLevels("build");
		console.log(
			`[dry-run] Task plan for "build" (${levels.flat().length} task(s)):`,
		);
		for (const [i, level] of levels.entries()) {
			console.log(`  Level ${i + 1}: ${level.join(", ")}`);
		}
		return;
	}

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
	const { createProgressReporter } = await import(
		"../../core/progress/reporter.js"
	);

	const runOptions = toRunOptions(ctx, opts);
	runOptions.onTaskEvent = createProgressReporter();

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

	if (opts.affected && ctx.affectedPackages !== undefined) {
		const affectedPkgs = ctx.affectedPackages;
		const affectedFilter = (taskName: string) => {
			const colon = taskName.indexOf(":");
			if (colon === -1) return true;
			return affectedPkgs.has(taskName.slice(0, colon));
		};
		const existing = runOptions.taskFilter;
		runOptions.taskFilter = existing
			? (name) => existing(name) && affectedFilter(name)
			: affectedFilter;
	}

	const results = await runTasksWithDeps("build", ctx.graph, runOptions);
	const cache = await readCache(ctx.cacheDir);
	printInsights(computeInsights(results, cache, ctx.config.cache.costPerMissMs));
}
