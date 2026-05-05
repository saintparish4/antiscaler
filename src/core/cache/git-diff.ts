/**
 * @module
 * Git-diff pre-filter. Translates a base-ref diff into an affected-package set
 * using the PackageGraph. Falls back gracefully (returns null) when
 * git is unavailable, enabling the runner to skip the optimization.
 */

import path from "node:path";
import type { PackageGraph } from "../graph/package-graph.js";

export interface GitDiffOptions {
	cwd: string;
	baseRef?: string;
}

export async function getChangedFiles(
	options: GitDiffOptions,
): Promise<string[] | null> {
	const { cwd, baseRef = "HEAD~1" } = options;
	try {
		const { execa } = await import("execa");
		const { stdout } = await execa("git", ["diff", "--name-only", baseRef], {
			cwd,
		});
		return stdout
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	} catch {
		return null;
	}
}

export function changedFilesToPackages(
	files: string[],
	graph: PackageGraph,
	cwd: string,
): Set<string> {
	const out = new Set<string>();
	for (const file of files) {
		const abs = path.resolve(cwd, file);
		for (const pkg of graph.packages) {
			const rel = path.relative(pkg.dir, abs);
			if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
				out.add(pkg.name);
				break;
			}
		}
	}
	return out;
}

export async function getChangedPackages(
	cwd: string,
	graph: PackageGraph,
	baseRef?: string,
): Promise<Set<string> | null> {
	const files = await getChangedFiles(
		baseRef === undefined ? { cwd } : { cwd, baseRef },
	);
	if (files === null) return null;
	return changedFilesToPackages(files, graph, cwd);
}
