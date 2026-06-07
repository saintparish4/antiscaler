import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	registerPrCheckAction,
	registerPrReplayAction,
	registerPrReportAction,
	runPrCheck,
	runPrReplay,
} from "../pr.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-pr-"));
	tmpDirs.push(dir);
	return dir;
}

function makeTraceFile(
	dir: string,
	sessionId: string,
	modules: Array<{ file: string; route?: string }> = [],
	routes: Array<{ path: string; modules: string[] }> = [],
): void {
	const traceDir = path.join(dir, ".antiscale", "traces");
	mkdirSync(traceDir, { recursive: true });
	writeFileSync(
		path.join(traceDir, `${sessionId}.json`),
		JSON.stringify({
			schemaVersion: 1,
			sessionId,
			startedAt: Date.now(),
			endedAt: Date.now() + 100,
			framework: "next",
			modules,
			routes,
		}),
		"utf8",
	);
}

afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds handles briefly; OS cleans up
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("runPrCheck", () => {
	it("returns safe-to-skip with no changed files when git unavailable", async () => {
		const dir = makeTmpDir();
		const result = await runPrCheck(dir, { base: "main" });
		expect(result.verdict).toBe("safe-to-skip");
		expect(result.tsFilesChanged).toBe(0);
		expect(result.files).toHaveLength(0);
		expect(result.baseRef).toBe("main");
	});

	it("defaults base ref to main", async () => {
		const dir = makeTmpDir();
		const result = await runPrCheck(dir, {});
		expect(result.baseRef).toBe("main");
	});

	it("respects custom base ref", async () => {
		const dir = makeTmpDir();
		const result = await runPrCheck(dir, { base: "origin/main" });
		expect(result.baseRef).toBe("origin/main");
	});
});

describe("runPrReplay", () => {
	it("returns null when no trace session exists", async () => {
		const dir = makeTmpDir();
		const result = await runPrReplay(dir, { base: "main" });
		expect(result).toBeNull();
	});

	it("returns trace metadata when session file exists", async () => {
		const dir = makeTmpDir();
		makeTraceFile(dir, "session-abc");
		const result = await runPrReplay(dir, {
			base: "main",
			session: "session-abc",
		});
		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe("session-abc");
		expect(result?.framework).toBe("next");
		expect(result?.baseRef).toBe("main");
	});

	it("returns empty touched arrays when git is unavailable", async () => {
		const dir = makeTmpDir();
		makeTraceFile(dir, "session-xyz");
		const result = await runPrReplay(dir, {
			base: "main",
			session: "session-xyz",
		});
		expect(result).not.toBeNull();
		expect(result?.changedFiles).toHaveLength(0);
		expect(result?.touchedModules).toHaveLength(0);
		expect(result?.touchedRoutes).toHaveLength(0);
		expect(result?.touchedPackages).toHaveLength(0);
	});

	it("defaults to last session", async () => {
		const dir = makeTmpDir();
		makeTraceFile(dir, "session-last");
		const result = await runPrReplay(dir, { base: "main" });
		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe("session-last");
	});

	it("stores route data from the trace session", async () => {
		const dir = makeTmpDir();
		const absFile = path.join(dir, "src", "page.ts");
		makeTraceFile(
			dir,
			"session-routes",
			[{ file: absFile }],
			[{ path: "/home", modules: [absFile] }],
		);
		const result = await runPrReplay(dir, {
			base: "main",
			session: "session-routes",
		});
		expect(result).not.toBeNull();
		// git unavailable → changedFiles empty → no intersection, but trace
		// metadata (routes list) is still present in the trace object
		expect(result?.touchedRoutes).toHaveLength(0);
		expect(result?.sessionId).toBe("session-routes");
	});
});

describe("registerPrCheckAction", () => {
	it("prints base ref and safe-to-skip verdict", async () => {
		const dir = makeTmpDir();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrCheckAction({ base: "main" });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("main");
			expect(out).toContain("safe to skip build");
			expect(out).toContain("Changed .ts files: 0");
		} finally {
			process.cwd = origCwd;
		}
	});
});

describe("registerPrReplayAction", () => {
	it("prints no-trace message when session is missing", async () => {
		const dir = makeTmpDir();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReplayAction({ base: "main" });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("No trace session found");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("prints session metadata when trace file exists", async () => {
		const dir = makeTmpDir();
		makeTraceFile(dir, "session-print");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReplayAction({
				base: "main",
				session: "session-print",
			});
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("session-print");
			expect(out).toContain("No traced routes");
		} finally {
			process.cwd = origCwd;
		}
	});
});

describe("registerPrReportAction", () => {
	it("outputs valid JSON by default", async () => {
		const dir = makeTmpDir();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReportAction({ base: "main" });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			const parsed = JSON.parse(out) as {
				check: { verdict: string };
				replay: unknown;
				generatedAt: string;
			};
			expect(parsed.check).toBeDefined();
			expect(parsed.replay).toBeNull();
			expect(parsed.generatedAt).toBeTruthy();
			expect(parsed.check.verdict).toBe("safe-to-skip");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("outputs markdown when --markdown flag is set", async () => {
		const dir = makeTmpDir();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReportAction({ base: "main", markdown: true });
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("## Antiscaler PR Report");
			expect(out).toContain("### Semantic Diff");
			expect(out).toContain("Safe to skip build");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("writes JSON to file when --output is specified", async () => {
		const { readFile } = await import("node:fs/promises");
		const dir = makeTmpDir();
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReportAction({ base: "main", output: "report.json" });
			const content = await readFile(path.join(dir, "report.json"), "utf8");
			const parsed = JSON.parse(content) as { check: unknown; replay: unknown };
			expect(parsed.check).toBeDefined();
		} finally {
			process.cwd = origCwd;
		}
	});

	it("writes markdown to file when --markdown and --output are set", async () => {
		const { readFile } = await import("node:fs/promises");
		const dir = makeTmpDir();
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			await registerPrReportAction({
				base: "main",
				markdown: true,
				output: "report.md",
			});
			const content = await readFile(path.join(dir, "report.md"), "utf8");
			expect(content).toContain("## Antiscaler PR Report");
		} finally {
			process.cwd = origCwd;
		}
	});
});
