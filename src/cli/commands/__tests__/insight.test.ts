import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-insight-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds directory handles briefly; the OS cleans these up eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerInsightAction", () => {
	it("prints 'No cached task data yet' when cache file does not exist", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {},
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerInsightAction } = await import("../insight.js");
			await registerInsightAction();
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("No cached task data yet");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("shows cached task history when cache file has entries", async () => {
		const dir = makeTmpDir();
		const cacheDir = path.join(dir, ".antiscale/cache");
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {},
				cache: { directory: cacheDir },
			}),
		);
		mkdirSync(cacheDir, { recursive: true });
		writeFileSync(
			path.join(cacheDir, "cache.json"),
			JSON.stringify({
				tasks: {
					build: { lastRun: Date.now() - 60000, lastDurationMs: 1234 },
				},
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerInsightAction } = await import("../insight.js");
			await registerInsightAction();
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("build");
			expect(out).toContain("1234ms");
		} finally {
			process.cwd = origCwd;
		}
	});
});
