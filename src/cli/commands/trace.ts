import { runTasksWithDeps } from "../../core/execution/runner.js";
import { loadPackageGraph } from "../../core/graph/package-graph.js";
import { loadTrace, tracedPackages } from "../../core/scope/trace-loader.js";
import { createContext, toRunOptions } from "../context.js";

export async function registerTraceAction(): Promise<void> {
	const ctx = await createContext();
	process.env["ANTISCALER_TRACE"] = "1";
	await runTasksWithDeps("dev", ctx.graph, toRunOptions(ctx));
}

export async function registerTraceAnalyzeAction(
	sessionId: string = "last",
): Promise<void> {
	const ctx = await createContext();

	const trace = await loadTrace(ctx.cwd, sessionId);
	const pkgGraph = await loadPackageGraph(ctx.cwd).catch(() => ({
		packages: [] as Awaited<ReturnType<typeof loadPackageGraph>>["packages"],
		edges: new Map<string, ReadonlySet<string>>(),
	}));

	const touched = tracedPackages(trace, pkgGraph);
	const startedAt = new Date(trace.startedAt).toLocaleString();
	const durationMs = trace.endedAt - trace.startedAt;

	console.log(`\nTrace session : ${trace.sessionId}`);
	console.log(`Framework     : ${trace.framework}`);
	console.log(`Started       : ${startedAt}`);
	console.log(`Duration      : ${durationMs}ms`);
	console.log(`Modules       : ${trace.modules.length}`);
	console.log(`Routes        : ${trace.routes.length}`);

	if (trace.routes.length > 0) {
		console.log("\nRoutes:");
		for (const route of trace.routes) {
			const mc = route.modules.length;
			console.log(
				`  ${route.path}  (${mc} ${mc === 1 ? "module" : "modules"})`,
			);
		}
	}

	if (pkgGraph.packages.length > 0) {
		const byPkg = new Map<string, number>();
		for (const m of trace.modules) {
			for (const pkg of pkgGraph.packages) {
				if (m.file.startsWith(pkg.dir)) {
					byPkg.set(pkg.name, (byPkg.get(pkg.name) ?? 0) + 1);
					break;
				}
			}
		}
		console.log(`\nPackages touched (${touched.size}):`);
		for (const [pkg, count] of [...byPkg.entries()].sort(
			(a, b) => b[1] - a[1],
		)) {
			console.log(
				`  ${pkg.padEnd(32)} ${count} module${count === 1 ? "" : "s"}`,
			);
		}
	}
}
