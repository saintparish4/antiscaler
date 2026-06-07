import type { TraceFile } from "../../tracer/types.js";

export function isCriticalChange(
	changedFiles: string[],
	trace: TraceFile,
	criticalPaths: string[],
): boolean {
	if (criticalPaths.length === 0) return true;
	const criticalModules = new Set<string>();
	for (const route of trace.routes) {
		if (criticalPaths.some((p) => matchRoute(p, route.path))) {
			for (const m of route.modules) criticalModules.add(m);
		}
	}
	return changedFiles.some((f) => criticalModules.has(f));
}

function matchRoute(pattern: string, route: string): boolean {
	if (pattern === route) return true;
	if (pattern.endsWith("/*")) {
		const prefix = pattern.slice(0, -2);
		return route === prefix || route.startsWith(`${prefix}/`);
	}
	return false;
}
