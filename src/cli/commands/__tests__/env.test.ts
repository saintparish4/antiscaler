import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-env-"));
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

describe("registerEnvAction", () => {
	it("prints Package Manager, Runtime, and Framework lines", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({ tasks: {} }),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerEnvAction } = await import("../env.js");
			await registerEnvAction();
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toMatch(/Package Manager/i);
			expect(out).toMatch(/Runtime/i);
			expect(out).toMatch(/Framework/i);
		} finally {
			process.cwd = origCwd;
		}
	});

	it("reports 'none detected' framework for a plain project with no framework", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({ tasks: {} }),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerEnvAction } = await import("../env.js");
			await registerEnvAction();
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("none detected");
		} finally {
			process.cwd = origCwd;
		}
	});
});
