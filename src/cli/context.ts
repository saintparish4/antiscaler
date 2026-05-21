import { genericAdapter } from "../adapters/frameworks/generic.js";
import { nextAdapter, nextPlugin } from "../adapters/frameworks/next.js";
import { wrapFrameworkAsPlugin } from "../adapters/frameworks/plugin.js";
import { viteAdapter } from "../adapters/frameworks/vite.js";
import { getChangedFiles, getChangedPackages } from "../core/cache/git-diff.js";
import { loadConfig } from "../core/config/loader.js";
import { detectProject } from "../core/detection/project.js";
import type { RunOptions } from "../core/execution/runner.js";
import { priorityFromConfig } from "../core/execution/scheduler.js";
import {
	loadPackageGraph,
	tasksFromPackageGraph,
} from "../core/graph/package-graph.js";
import { buildGraph } from "../core/graph/planner.js";
import { PluginRegistry } from "../core/plugins/registry.js";
import { isCriticalChange } from "../core/scope/critical-path.js";
import { loadTrace } from "../core/scope/trace-loader.js";
import type { AntiscaleContext } from "../types/index.js";

export async function createContext(
	cwd: string = process.cwd(),
): Promise<AntiscaleContext> {
	// Detect PM/runtime/framework once; reuse throughout context construction.
	const [rawConfig, { pm, runtime, framework }] = await Promise.all([
		loadConfig(cwd),
		detectProject(cwd),
	]);

	let config = rawConfig;

	let pkgGraph: Awaited<ReturnType<typeof loadPackageGraph>> | undefined;
	if (config.workspace?.enabled) {
		pkgGraph = await loadPackageGraph(cwd);
		config = {
			...config,
			tasks: tasksFromPackageGraph(
				pkgGraph,
				config.tasks,
				config.workspace.scripts,
				pm.name,
			),
		};
	}

	let packageScopes: string[] | undefined;
	if (config.git?.enabled !== false) {
		const graph =
			pkgGraph ??
			(await loadPackageGraph(cwd).catch(() => ({
				packages: [] as Array<{
					name: string;
					dir: string;
					manifest: { name: string };
				}>,
				edges: new Map<string, ReadonlySet<string>>(),
			})));
		const changed = await getChangedPackages(cwd, graph, config.git?.baseRef);
		// null  -> git unavailable; skip optimization
		// empty -> no packages matched (single-pkg repo or no changes yet);
		//          skip filtering to avoid hashing zero files
		if (changed !== null && changed.size > 0) {
			packageScopes = graph.packages
				.filter((p) => changed.has(p.name))
				.map((p) => p.dir);
		}
	}

	// If lintOnlyForNonCritical is enabled, check whether changed files touch
	// any critical routes. If not, restrict execution to lint-named tasks only.
	let lintOnly = false;
	const perf = config.performance;
	if (perf?.lintOnlyForNonCritical && (perf.criticalPaths?.length ?? 0) > 0) {
		const trace = await loadTrace(cwd, "last").catch(() => null);
		if (trace !== null) {
			const changedFiles = await getChangedFiles({
				cwd,
				...(config.git?.baseRef !== undefined
					? { baseRef: config.git.baseRef }
					: {}),
			}).catch(() => null);
			if (changedFiles !== null) {
				lintOnly = !isCriticalChange(
					changedFiles,
					trace,
					perf.criticalPaths ?? [],
				);
				if (lintOnly) {
					process.stderr.write(
						"[antiscaler] No critical-path changes detected — running lint tasks only\n",
					);
				}
			}
		}
	}

	const cacheDir = config.cache.directory;

	const plugins = new PluginRegistry();
	plugins.register(wrapFrameworkAsPlugin(nextAdapter));
	plugins.register(wrapFrameworkAsPlugin(viteAdapter));
	plugins.register(wrapFrameworkAsPlugin(genericAdapter));
	plugins.register(nextPlugin);

	await plugins.runOnDetect({
		cwd,
		pm: pm.name,
		framework: framework?.name ?? null,
		tasks: config.tasks,
	});

	const graph = buildGraph(config);

	return {
		cwd,
		config,
		pm: pm.name,
		runtime: { primary: runtime.name, fallback: "node" },
		framework: framework?.name ?? null,
		graph,
		cacheDir,
		plugins,
		...(packageScopes !== undefined ? { packageScopes } : {}),
		...(lintOnly ? { lintOnly: true } : {}),
	};
}

/**
 * Lifts an AntiscaleContext into the flat RunOptions shape that the runner
 * expects. Every CLI command that calls runTasksWithDeps should go through
 * this helper -- it is the single source of truth for context-to-options
 * translation.
 */
export function toRunOptions(
	ctx: AntiscaleContext,
	overrides: { concurrency?: number } = {},
): RunOptions {
	const schedulerEnabled = ctx.config.scheduler?.policy !== undefined;
	const derivedPriorityOf = schedulerEnabled
		? priorityFromConfig(ctx.config, ctx.config.tasks)
		: undefined;
	return {
		cwd: ctx.cwd,
		cacheDir: ctx.cacheDir,
		pm: ctx.pm,
		config: ctx.config,
		tasks: ctx.config.tasks,
		plugins: ctx.plugins,
		...(ctx.packageScopes !== undefined
			? { packageScopes: ctx.packageScopes }
			: {}),
		...(schedulerEnabled ? { useScheduler: true } : {}),
		...(derivedPriorityOf !== undefined
			? { priorityOf: derivedPriorityOf }
			: {}),
		...(overrides.concurrency !== undefined
			? { concurrency: overrides.concurrency }
			: {}),
		...(ctx.lintOnly
			? { taskFilter: (name: string) => /lint/i.test(name) }
			: {}),
	};
}
