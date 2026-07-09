/**
 * @module
 * `antiscaler workspace check` (roadmap 1.6) — CI gate comparing declared
 * dependencies against actual imports. Prints grouped violations and sets
 * exit code 1 when any are found so CI fails the build.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceCheckResult } from "../../core/graph/workspace-check.js";

export interface WorkspaceCheckOptions {
	/** Print the result as JSON instead of the human report. */
	json?: boolean;
}

/** Testable core: build the graphs, gather manifests, run the check. */
export async function runWorkspaceCheck(
	cwd: string,
): Promise<WorkspaceCheckResult | null> {
	const { loadPackageGraph } = await import(
		"../../core/graph/package-graph.js"
	);
	const packageGraph = await loadPackageGraph(cwd).catch(() => null);
	if (packageGraph === null || packageGraph.packages.length === 0) {
		return null;
	}

	const { updateSymbolGraph } = await import(
		"../../core/semantic/symbol-graph.js"
	);
	const { checkWorkspace } = await import(
		"../../core/graph/workspace-check.js"
	);

	const packages = packageGraph.packages.map((pkg) => ({
		name: pkg.manifest.name,
		dir: path.relative(cwd, pkg.dir).replace(/\\/g, "/"),
		declared: new Set([
			...Object.keys(pkg.manifest.dependencies ?? {}),
			...Object.keys(pkg.manifest.devDependencies ?? {}),
			...Object.keys(pkg.manifest.peerDependencies ?? {}),
		]),
	}));

	const { graph: symbolGraph } = await updateSymbolGraph(cwd);

	return checkWorkspace({
		symbolGraph,
		packages,
		rootDeclared: await readRootDeclared(cwd),
	});
}

export async function registerWorkspaceCheckAction(
	opts: WorkspaceCheckOptions = {},
): Promise<void> {
	const cwd = process.cwd();
	const result = await runWorkspaceCheck(cwd);

	if (result === null) {
		console.log(
			"workspace check: no workspace packages found (pnpm-workspace.yaml or package.json `workspaces` required).",
		);
		return;
	}

	if (opts.json === true) {
		console.log(JSON.stringify(result, null, 2));
		if (result.violations.length > 0) process.exitCode = 1;
		return;
	}

	console.log(
		`\nChecked ${result.packagesChecked} package${result.packagesChecked === 1 ? "" : "s"}.`,
	);

	if (result.violations.length === 0) {
		console.log("\nNo dependency violations found.");
		return;
	}

	const MAX_FILES_SHOWN = 5;
	const describe: Record<
		string,
		(v: { package: string; target: string }) => string
	> = {
		"undeclared-workspace-dep": (v) =>
			`${v.package} imports ${v.target} but does not declare it`,
		"undeclared-external-dep": (v) =>
			`${v.package} imports ${v.target} but neither it nor the workspace root declares it`,
		"cross-package-relative-import": (v) =>
			`${v.package} reaches into ${v.target} via a relative import (bypasses its public entry)`,
	};

	console.log("");
	for (const violation of result.violations) {
		console.log(`  ✗ ${describe[violation.kind]?.(violation)}`);
		for (const file of violation.files.slice(0, MAX_FILES_SHOWN)) {
			console.log(`      ${file}`);
		}
		if (violation.files.length > MAX_FILES_SHOWN) {
			console.log(
				`      … and ${violation.files.length - MAX_FILES_SHOWN} more file(s)`,
			);
		}
	}

	console.log(
		`\n${result.violations.length} violation${result.violations.length === 1 ? "" : "s"} found.`,
	);
	process.exitCode = 1;
}

async function readRootDeclared(cwd: string): Promise<Set<string>> {
	try {
		const manifest = JSON.parse(
			await readFile(path.join(cwd, "package.json"), "utf8"),
		) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			peerDependencies?: Record<string, string>;
		};
		return new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.devDependencies ?? {}),
			...Object.keys(manifest.peerDependencies ?? {}),
		]);
	} catch {
		return new Set();
	}
}
