/**
 * @module
 * Resolves `--scope=<session>` to the package set a trace session exercised,
 * so the scheduler can run those packages first.
 */

import { loadPackageGraph } from "../graph/package-graph.js";
import { loadTrace, tracedPackages } from "./trace-loader.js";

export async function tracedPackagesForSession(
	cwd: string,
	sessionId: string,
): Promise<ReadonlySet<string>> {
	const [trace, packageGraph] = await Promise.all([
		loadTrace(cwd, sessionId),
		loadPackageGraph(cwd),
	]);
	return tracedPackages(trace, packageGraph);
}
