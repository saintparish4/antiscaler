/**
 * @module
 * Gathers everything `checkWorkspace` needs from disk — the package graph,
 * each manifest's declared dependencies, the root manifest, and a fresh symbol
 * graph — and runs the audit. `workspace-check.ts` stays pure; this is the
 * layer that touches the filesystem.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { updateSymbolGraph } from "../semantic/symbol-graph.js";
import { loadPackageGraph } from "./package-graph.js";
import type { WorkspaceCheckResult } from "./workspace-check.js";
import { checkWorkspace } from "./workspace-check.js";

interface DependencyManifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

/**
 * All three dependency kinds count as "declared": a build-time-only import is
 * satisfied by a devDependency, and a peerDependency is satisfied by the
 * consumer.
 */
function declaredNames(manifest: DependencyManifest): Set<string> {
	return new Set([
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {}),
		...Object.keys(manifest.peerDependencies ?? {}),
	]);
}

async function readRootDeclared(cwd: string): Promise<Set<string>> {
	try {
		const manifest = JSON.parse(
			await readFile(path.join(cwd, "package.json"), "utf8"),
		) as DependencyManifest;
		return declaredNames(manifest);
	} catch {
		return new Set();
	}
}

/** Returns null when the directory is not a workspace (nothing to audit). */
export async function auditWorkspace(
	cwd: string,
): Promise<WorkspaceCheckResult | null> {
	const packageGraph = await loadPackageGraph(cwd).catch(() => null);
	if (packageGraph === null || packageGraph.packages.length === 0) return null;

	const packages = packageGraph.packages.map((pkg) => ({
		name: pkg.manifest.name,
		dir: path.relative(cwd, pkg.dir).replace(/\\/g, "/"),
		declared: declaredNames(pkg.manifest),
	}));

	const { graph: symbolGraph } = await updateSymbolGraph(cwd);

	return checkWorkspace({
		symbolGraph,
		packages,
		rootDeclared: await readRootDeclared(cwd),
	});
}
