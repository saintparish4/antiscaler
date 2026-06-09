import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-doctor-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerDoctorAction", () => {
	it("prints ok for Node version and valid config", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({ tasks: { build: { command: "echo ok" } } }),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDoctorAction } = await import("../doctor.js");
			await registerDoctorAction();
			const lines = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(lines).toMatch(/Node.*meets/i);
			expect(lines).toMatch(/Config.*valid/i);
		} finally {
			process.cwd = origCwd;
		}
	});

	it("flags missing config file and exits 1", async () => {
		const dir = makeTmpDir();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const exit = vi.spyOn(process, "exit").mockImplementation((_code) => {
			throw new Error("process.exit");
		});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDoctorAction } = await import("../doctor.js");
			await expect(registerDoctorAction()).rejects.toThrow("process.exit");
			expect(exit).toHaveBeenCalledWith(1);
			const lines = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(lines).toMatch(/No antiscale\.config/i);
		} finally {
			process.cwd = origCwd;
		}
	});

	it("flags config with unknown dependsOn task and exits 1", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: { dependsOn: ["ghost"] } },
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const exit = vi.spyOn(process, "exit").mockImplementation((_code) => {
			throw new Error("process.exit");
		});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerDoctorAction } = await import("../doctor.js");
			await expect(registerDoctorAction()).rejects.toThrow("process.exit");
			expect(exit).toHaveBeenCalledWith(1);
			const lines = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(lines).toMatch(/Config validation failed/i);
		} finally {
			process.cwd = origCwd;
		}
	});
});
