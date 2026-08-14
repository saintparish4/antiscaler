/**
 * Boundary: the semantic differ meeting real files and a real git history.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerDiffAction } from "../../cli/commands/diff.js";
import {
	captureGlobalOutput,
	cleanupTempWorkspaces,
	createTempWorkspace,
	restoreGlobalPrinter,
	withCwd,
	writeFiles,
} from "../helpers/cli-harness.js";

afterEach(() => {
	cleanupTempWorkspaces();
	restoreGlobalPrinter();
});

describe("diff command", () => {
	it("classifies a new exported function as breaking", async () => {
		const dir = createTempWorkspace("diff");
		writeFiles(dir, {
			"subject.ts": "export function hello(): string { return 'hi'; }\n",
		});
		const output = captureGlobalOutput();

		// Not a git repo, so the baseline resolves to empty: every export is new.
		await withCwd(dir, () => registerDiffAction("subject.ts"));

		expect(output.stdout()).toContain("subject.ts");
		expect(output.stdout()).toContain("breaking");
		expect(output.stdout()).toContain("HEAD~1");
	});

	it("classifies a file with no exports as non-impacting", async () => {
		const dir = createTempWorkspace("diff");
		writeFiles(dir, { "empty.ts": "// just a comment\n" });
		const output = captureGlobalOutput();

		await withCwd(dir, () => registerDiffAction("empty.ts"));

		expect(output.stdout()).toContain("non-impacting");
	});

	it("reports the base ref given by --base", async () => {
		const dir = createTempWorkspace("diff");
		writeFiles(dir, { "thing.ts": "export const x = 1;\n" });
		const output = captureGlobalOutput();

		await withCwd(dir, () => registerDiffAction("thing.ts", { base: "main" }));

		expect(output.stdout()).toContain("main");
	});

	/**
	 * Regression test for a Windows-only bug: `path.relative` yields
	 * backslash-separated paths, which `git show <ref>:<path>` rejects as a
	 * pathspec (git is POSIX-separated internally on every host). The failure
	 * was swallowed by the empty-baseline fallback, so a body-only edit to a
	 * nested file misclassified as `breaking` — every export looked added. It
	 * only reproduces on a real repo with a file more than one directory deep.
	 */
	it("classifies a body-only edit to a nested file as internal", async () => {
		const dir = createTempWorkspace("diff");
		const relPath = path.join("packages", "ui", "src", "index.ts");
		writeFiles(dir, {
			[relPath]:
				"export function formatPrice(cents: number): string {\n" +
				"  return `$${(cents / 100).toFixed(2)}`;\n" +
				"}\n",
		});

		const identity = "-c user.email=t@t.com -c user.name=T";
		const git = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "ignore" });
		git("git init");
		git("git add .");
		git(`git ${identity} commit -m initial`);

		writeFiles(dir, {
			[relPath]:
				"export function formatPrice(cents: number): string {\n" +
				"  const dollars = cents / 100;\n" +
				"  return `$${dollars.toFixed(2)}`;\n" +
				"}\n",
		});

		const output = captureGlobalOutput();
		await withCwd(dir, () => registerDiffAction(relPath, { base: "HEAD" }));

		expect(output.stdout()).toContain("internal");
		expect(output.stdout()).not.toContain("breaking");
		expect(output.stdout()).toContain("packages/ui/src/index.ts");
	});
});
