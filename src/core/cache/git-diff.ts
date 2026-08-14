/**
 * @module
 * Git-diff pre-filter. Translates a base-ref diff into an affected-package set
 * using the PackageGraph. Falls back gracefully (returns null) when
 * git is unavailable, enabling the runner to skip the optimization.
 */

import path from "node:path";
import type { PackageGraph } from "../graph/package-graph.js";
import { packageForFile } from "../graph/package-graph.js";
import { listChangedFiles } from "../vcs/git.js";

export interface GitDiffOptions {
	cwd: string;
	baseRef?: string;
}

export async function getChangedFiles(
	options: GitDiffOptions,
): Promise<string[] | null> {
	const { cwd, baseRef = "HEAD~1" } = options;
	return listChangedFiles(cwd, baseRef);
}

export function changedFilesToPackages(
	files: string[],
	graph: PackageGraph,
	cwd: string,
): Set<string> {
	const out = new Set<string>();
	for (const file of files) {
		const owner = packageForFile(path.resolve(cwd, file), graph);
		if (owner !== null) out.add(owner.name);
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
