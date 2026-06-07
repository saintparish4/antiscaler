import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiscaleError } from "../../../core/errors.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-run-"));
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

describe("registerRunAction", () => {
	it("runs a named task and prints insight output", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {
					lint: { command: "echo lint-ok" },
				},
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerRunAction } = await import("../run.js");
			await registerRunAction("lint");
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("lint");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("rejects with AntiscaleError when the task is not in the graph", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { lint: { command: "echo lint-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerRunAction } = await import("../run.js");
			await expect(registerRunAction("nonexistent")).rejects.toBeInstanceOf(
				AntiscaleError,
			);
		} finally {
			process.cwd = origCwd;
		}
	});

	it("respects concurrency option without throwing", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { lint: { command: "echo lint-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerRunAction } = await import("../run.js");
			await expect(
				registerRunAction("lint", { concurrency: 1 }),
			).resolves.toBeUndefined();
		} finally {
			process.cwd = origCwd;
		}
	});
});
