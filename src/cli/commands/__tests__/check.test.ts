import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../../../core/errors.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-check-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows may hold directory handles briefly after child processes exit;
			// temp dirs are cleaned up by the OS eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerCheckAction", () => {
	it("succeeds with valid config and task graph", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: {}, lint: {} },
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		// Override cwd for createContext
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerCheckAction } = await import("../check.js");
			await registerCheckAction();
			expect(log).toHaveBeenCalledWith(expect.stringMatching(/valid/i));
		} finally {
			process.cwd = origCwd;
		}
	});

	it("succeeds when all dependsOn references are valid tasks", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {
					lint:  {},
					build: { dependsOn: ["lint"] },
				},
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerCheckAction } = await import("../check.js");
			await registerCheckAction();
			expect(log).toHaveBeenCalledWith(expect.stringMatching(/valid/i));
		} finally {
			process.cwd = origCwd;
		}
	});

	it("throws ConfigError when dependsOn references unknown task", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {
					build: { dependsOn: ["nonexistent"] },
				},
			}),
		);
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerCheckAction } = await import("../check.js");
			await expect(registerCheckAction()).rejects.toBeInstanceOf(ConfigError);
		} finally {
			process.cwd = origCwd;
		}
	});
});
