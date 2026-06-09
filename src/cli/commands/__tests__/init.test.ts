import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerInitAction } from "../init.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-init-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerInitAction", () => {
	it("creates antiscale.config.ts when none exists", async () => {
		const dir = makeTmpDir();
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const log = vi.spyOn(console, "log").mockImplementation(() => {});
			await registerInitAction();
			expect(existsSync(path.join(dir, "antiscale.config.ts"))).toBe(true);
			expect(log).toHaveBeenCalledWith(expect.stringMatching(/Created/));
		} finally {
			process.cwd = origCwd;
		}
	});

	it("does not overwrite existing config", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "antiscale.config.ts"), "// existing");
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const log = vi.spyOn(console, "log").mockImplementation(() => {});
			await registerInitAction();
			expect(log).toHaveBeenCalledWith(expect.stringMatching(/already exists/));
		} finally {
			process.cwd = origCwd;
		}
	});

	it("does not overwrite when antiscale.config.json exists", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "antiscale.config.json"), "{}");
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const log = vi.spyOn(console, "log").mockImplementation(() => {});
			await registerInitAction();
			expect(log).toHaveBeenCalledWith(
				expect.stringMatching(/antiscale\.config\.json.*already exists/),
			);
			expect(existsSync(path.join(dir, "antiscale.config.ts"))).toBe(false);
		} finally {
			process.cwd = origCwd;
		}
	});
});
