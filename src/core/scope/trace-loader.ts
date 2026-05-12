/**
 * @module
 * Reads trace JSON files written by src/tracer and converts them into the
 * package set the scheduler should restrict its work to.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TraceFile } from "../../tracer/types.js";
import type { PackageGraph } from "../graph/package-graph.js";

export async function loadTrace(
	cwd: string,
	sessionId: string | "last",
): Promise<TraceFile> {
	const dir = path.resolve(cwd, ".antiscale/traces");
	const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
	if (sessionId === "last") {
		files.sort();
		const latest = files[files.length - 1];
		if (!latest) throw new Error("No trace files found");
		sessionId = latest.replace(/\.json$/, "");
	}
	return JSON.parse(
		await readFile(path.join(dir, `${sessionId}.json`), "utf8"),
	) as TraceFile;
}

export function tracedPackages(
	trace: TraceFile,
	graph: PackageGraph,
): Set<string> {
	const out = new Set<string>();
	for (const m of trace.modules) {
		for (const pkg of graph.packages) {
			if (m.file.startsWith(pkg.dir)) {
				out.add(pkg.name);
				break;
			}
		}
	}
	return out;
}
