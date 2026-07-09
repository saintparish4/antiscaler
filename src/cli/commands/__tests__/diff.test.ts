import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-diff-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds directory handles briefly; OS cleans these up eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerDiffAction", () => {
	it("classifies a new exported function as breaking", async () => {
		const dir = makeTmpDir();
		// A TypeScript file with a new exported function (git baseline = empty)
		writeFileSync(
			path.join(dir, "subject.ts"),
			"export function hello(): string { return 'hi'; }\n",
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDiffAction } = await import("../diff.js");
			// Git will fail (dir is not a repo) → before = "", after = exported fn
			// Result: added exports → "breaking"
			await registerDiffAction("subject.ts");
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("subject.ts");
			expect(out).toContain("breaking");
			expect(out).toContain("HEAD~1");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("classifies an empty file (no exports) as non-impacting", async () => {
		const dir = makeTmpDir();
		// File with no exports at all; git baseline also empty → identical result
		writeFileSync(path.join(dir, "empty.ts"), "// just a comment\n");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDiffAction } = await import("../diff.js");
			await registerDiffAction("empty.ts");
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			// Before = "" (git fails), after = "// just a comment"
			// No exported symbols in either → non-impacting
			expect(out).toContain("non-impacting");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("uses the --base option when provided", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "thing.ts"), "export const x = 1;\n");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDiffAction } = await import("../diff.js");
			await registerDiffAction("thing.ts", { base: "main" });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			// The base ref should appear in the output header
			expect(out).toContain("main");
		} finally {
			process.cwd = origCwd;
		}
	});

	// Regression test for a Windows-only bug: `path.relative` returns
	// backslash-separated paths, which `git show <ref>:<path>` rejects as a
	// pathspec (git always expects POSIX separators internally, regardless of
	// host OS). The failure was swallowed by the `before = ""` fallback, so a
	// body-only edit to a *nested* file misclassified as "breaking" (every
	// export looked "added") instead of "internal" — but only on a real git
	// repo with a file more than one directory deep, which the fixture-only
	// tests above never exercise (git always fails outright there).
	it("classifies a body-only edit to a nested file as internal (real git repo)", async () => {
		const dir = makeTmpDir();
		const nestedDir = path.join(dir, "packages", "ui", "src");
		mkdirSync(nestedDir, { recursive: true });
		const nestedFile = path.join(nestedDir, "index.ts");
		const nestedRelPath = path.join("packages", "ui", "src", "index.ts");

		writeFileSync(
			nestedFile,
			"export function formatPrice(cents: number): string {\n" +
				"  return `$${(cents / 100).toFixed(2)}`;\n" +
				"}\n",
		);

		const GIT = ["-c", "user.email=t@t.com", "-c", "user.name=T"].join(" ");
		const run = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "ignore" });
		run("git init");
		run("git add .");
		run(`git ${GIT} commit -m initial`);

		// Body-only edit: same signature, different implementation.
		writeFileSync(
			nestedFile,
			"export function formatPrice(cents: number): string {\n" +
				"  const dollars = cents / 100;\n" +
				"  return `$${dollars.toFixed(2)}`;\n" +
				"}\n",
		);

		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDiffAction } = await import("../diff.js");
			await registerDiffAction(nestedRelPath, { base: "HEAD" });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("internal");
			expect(out).not.toContain("breaking");
			// Displayed path is normalized to POSIX regardless of host separator.
			expect(out).toContain("packages/ui/src/index.ts");
		} finally {
			process.cwd = origCwd;
		}
	});
});
