import { genericAdapter } from "../adapters/frameworks/generic.js";
import { nextAdapter, nextPlugin } from "../adapters/frameworks/next.js";
import { wrapFrameworkAsPlugin } from "../adapters/frameworks/plugin.js";
import { viteAdapter } from "../adapters/frameworks/vite.js";
import { createHttpCacheAdapter } from "../core/cache/adapters/http-adapter.js";
import { createS3CacheAdapter } from "../core/cache/adapters/s3-adapter.js";
import { getChangedFiles, getChangedPackages } from "../core/cache/git-diff.js";
import type { RemoteCacheAdapter } from "../core/cache/remote-adapter.js";
import { loadConfig } from "../core/config/loader.js";
import { detectProject } from "../core/detection/project.js";
import { ConfigError } from "../core/errors.js";
import type { RunOptions } from "../core/execution/runner.js";
import { priorityFromConfig } from "../core/execution/scheduler.js";
import {
	computeAffectedPackages,
	loadPackageGraph,
	tasksFromPackageGraph,
} from "../core/graph/package-graph.js";
import { buildGraph } from "../core/graph/planner.js";
import { PluginRegistry } from "../core/plugins/registry.js";
import { isCriticalChange } from "../core/scope/critical-path.js";
import { loadTrace } from "../core/scope/trace-loader.js";
import type {
	AntiscaleContext,
	ResolvedAntiscaleConfig,
} from "../types/index.js";
import { reportPluginError } from "./render/plugin-errors.js";
import { errorLines } from "./render/writer.js";
import { getPrinter } from "./visuals/printer.js";

function buildRemoteAdapter(
	config: ResolvedAntiscaleConfig,
): RemoteCacheAdapter | undefined {
	const remote = config.cache.remote;
	if (remote === undefined) return undefined;

	if (remote.type === "http") {
		if (remote.url === undefined) {
			throw new ConfigError(
				'cache.remote.url is required when cache.remote.type is "http"',
			);
		}
		return createHttpCacheAdapter({
			url: remote.url,
			...(remote.headers !== undefined ? { headers: remote.headers } : {}),
			...(remote.timeout !== undefined ? { timeout: remote.timeout } : {}),
			...(remote.maxResponseBytes !== undefined
				? { maxResponseBytes: remote.maxResponseBytes }
				: {}),
		});
	}

	if (remote.bucket === undefined) {
		throw new ConfigError(
			'cache.remote.bucket is required when cache.remote.type is "s3"',
		);
	}
	return createS3CacheAdapter({
		bucket: remote.bucket,
		...(remote.prefix !== undefined ? { prefix: remote.prefix } : {}),
		...(remote.region !== undefined ? { region: remote.region } : {}),
		...(remote.endpoint !== undefined ? { endpoint: remote.endpoint } : {}),
	});
}

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
	let affectedPackages: ReadonlySet<string> | undefined;
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
			// Cascade: a package is affected if it changed directly OR if any
			// package it depends on changed (transitively).
			const affected = computeAffectedPackages(changed, graph);
			packageScopes = graph.packages
				.filter((p) => affected.has(p.name))
				.map((p) => p.dir);
			affectedPackages = affected;
		}
	}

	// Both a trace and a changed-file list are required to prove a change is
	// non-critical. Without either, the safe answer is to run everything —
	// this optimization must never skip work on an unproven assumption.
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
					errorLines(
						getPrinter(),
						"[antiscaler] No critical-path changes detected — running lint tasks only",
					);
				}
			}
		}
	}

	const cacheDir = config.cache.directory;
	const remoteCache = buildRemoteAdapter(config);

	const plugins = new PluginRegistry(reportPluginError);
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
		...(affectedPackages !== undefined ? { affectedPackages } : {}),
		...(lintOnly ? { lintOnly: true } : {}),
		...(remoteCache !== undefined ? { remoteCache } : {}),
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
		...(ctx.remoteCache !== undefined ? { remoteCache: ctx.remoteCache } : {}),
	};
}
