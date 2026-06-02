import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiscaleError } from "../../../core/errors.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-dev-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds directory handles briefly after child processes exit;
			// the OS cleans these up eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerDevAction", () => {
	it("runs the dev task and completes without error", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {
					dev: { command: "echo dev-ok" },
				},
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDevAction } = await import("../dev.js");
			await expect(registerDevAction()).resolves.toBeUndefined();
		} finally {
			process.cwd = origCwd;
		}
	});

	it("rejects with AntiscaleError when no 'dev' task is defined in config", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: { command: "echo build-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDevAction } = await import("../dev.js");
			await expect(registerDevAction()).rejects.toBeInstanceOf(AntiscaleError);
		} finally {
			process.cwd = origCwd;
		}
	});
});
