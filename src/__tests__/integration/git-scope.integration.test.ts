/**
 * Boundary: the git layer against a real repository. `core/vcs/git` shells out
 * and `core/cache/git-diff` maps its output onto the package graph — neither
 * claim can be verified without an actual repo and actual commits.
 */

import { execSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { getChangedPackages } from "../../core/cache/git-diff.js";
import { loadPackageGraph } from "../../core/graph/package-graph.js";
import {
	listChangedFiles,
	listChangedFilesSinceMergeBase,
	readFileAtRef,
} from "../../core/vcs/git.js";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeFiles,
} from "../helpers/cli-harness.js";

const IDENTITY = "-c user.email=t@t.com -c user.name=T";

function git(dir: string, command: string): void {
	execSync(`git ${command}`, { cwd: dir, stdio: "ignore" });
}

function commitAll(dir: string, message: string): void {
	git(dir, "add .");
	git(dir, `${IDENTITY} commit -m "${message}"`);
}

/** A two-package repo with one commit; the caller makes the second change. */
function repoWithBaseline(): string {
	const dir = createTempWorkspace("git");
	writeFiles(dir, {
		"pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
		"packages/utils/package.json": JSON.stringify({ name: "utils" }),
		"packages/utils/src/index.ts": "export const value = 1;\n",
		"packages/docs/package.json": JSON.stringify({ name: "docs" }),
		"packages/docs/src/index.ts": "export const doc = 1;\n",
	});
	git(dir, "init");
	commitAll(dir, "initial");
	return dir;
}

afterEach(cleanupTempWorkspaces);

describe("readFileAtRef", () => {
	it("returns the file's contents as of the ref", async () => {
		const dir = repoWithBaseline();
		writeFiles(dir, {
			"packages/utils/src/index.ts": "export const value = 2;\n",
		});

		expect(
			await readFileAtRef(dir, "HEAD", "packages/utils/src/index.ts"),
		).toBe("export const value = 1;");
	});

	it("returns null for a file that did not exist at the ref", async () => {
		const dir = repoWithBaseline();
		expect(
			await readFileAtRef(dir, "HEAD", "packages/utils/src/new.ts"),
		).toBeNull();
	});

	it("returns null outside a git repository instead of throwing", async () => {
		const dir = createTempWorkspace("git");
		expect(await readFileAtRef(dir, "HEAD", "anything.ts")).toBeNull();
	});
});

describe("listChangedFiles", () => {
	it("lists files differing from the ref", async () => {
		const dir = repoWithBaseline();
		writeFiles(dir, {
			"packages/utils/src/index.ts": "export const value = 2;\n",
		});

		expect(await listChangedFiles(dir, "HEAD")).toEqual([
			"packages/utils/src/index.ts",
		]);
	});

	it("returns an empty list when nothing changed", async () => {
		const dir = repoWithBaseline();
		expect(await listChangedFiles(dir, "HEAD")).toEqual([]);
	});

	it("returns null outside a git repository", async () => {
		const dir = createTempWorkspace("git");
		expect(await listChangedFiles(dir, "HEAD")).toBeNull();
	});
});

describe("listChangedFilesSinceMergeBase", () => {
	it("reports only what the branch added, not what the base advanced past", async () => {
		const dir = repoWithBaseline();
		git(dir, "branch base-branch");

		git(dir, "checkout -b feature");
		writeFiles(dir, {
			"packages/utils/src/feature.ts": "export const f = 1;\n",
		});
		commitAll(dir, "feature work");

		// Advance the base branch with an unrelated commit. A two-dot diff would
		// attribute this file to the branch; the three-dot range must not.
		git(dir, "checkout base-branch");
		writeFiles(dir, { "packages/docs/src/other.ts": "export const o = 1;\n" });
		commitAll(dir, "base work");
		git(dir, "checkout feature");

		expect(await listChangedFilesSinceMergeBase(dir, "base-branch")).toEqual([
			"packages/utils/src/feature.ts",
		]);
	});
});

describe("getChangedPackages", () => {
	it("maps changed files onto the workspace packages that own them", async () => {
		const dir = repoWithBaseline();
		writeFiles(dir, {
			"packages/utils/src/index.ts": "export const value = 2;\n",
		});

		const changed = await getChangedPackages(
			dir,
			await loadPackageGraph(dir),
			"HEAD",
		);

		expect(changed).toEqual(new Set(["utils"]));
	});

	it("returns null when git is unavailable so callers skip the optimization", async () => {
		const dir = createTempWorkspace("git");
		writeFiles(dir, {
			"pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
			"packages/solo/package.json": JSON.stringify({ name: "solo" }),
		});

		expect(
			await getChangedPackages(dir, await loadPackageGraph(dir), "HEAD"),
		).toBeNull();
	});
});
