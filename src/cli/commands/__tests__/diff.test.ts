import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
		writeFileSync(
			path.join(dir, "thing.ts"),
			"export const x = 1;\n",
		);
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
});
