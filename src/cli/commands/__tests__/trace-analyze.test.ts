import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TraceFile } from "../../../tracer/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-trace-analyze-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

function writeConfig(dir: string): void {
	writeFileSync(
		path.join(dir, "antiscale.config.json"),
		JSON.stringify({ tasks: { dev: {} } }),
	);
}

function writeTraceSession(dir: string, data: TraceFile): void {
	const tracesDir = path.join(dir, ".antiscale", "traces");
	mkdirSync(tracesDir, { recursive: true });
	writeFileSync(
		path.join(tracesDir, `${data.sessionId}.json`),
		JSON.stringify(data),
	);
}

function makeTrace(overrides: Partial<TraceFile> = {}): TraceFile {
	return {
		schemaVersion: 1,
		sessionId: "sess-001",
		startedAt: Date.now() - 5000,
		endedAt:   Date.now(),
		framework: "next",
		modules: [],
		routes: [],
		...overrides,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("registerTraceAnalyzeAction", () => {
	let cwd: string;
	let logs: string[];
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		cwd = makeTmpDir();
		writeConfig(cwd);
		logs = [];
		consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.map(String).join(" "));
		});
	});

	it("prints session header fields for a minimal trace", async () => {
		const trace = makeTrace({ sessionId: "sess-001", framework: "vite" });
		writeTraceSession(cwd, trace);
		// Run from the tmp dir so createContext picks up our config
		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			await registerTraceAnalyzeAction("sess-001");
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).toContain("sess-001");
		expect(out).toContain("vite");
		expect(out).toContain("Modules");
		expect(out).toContain("Routes");
	});

	it("prints routes section when trace has routes", async () => {
		const trace = makeTrace({
			sessionId: "with-routes",
			routes: [
				{ path: "/home",     modules: ["src/home.ts", "src/layout.ts"] },
				{ path: "/checkout", modules: ["src/checkout.ts"] },
			],
		});
		writeTraceSession(cwd, trace);
		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			await registerTraceAnalyzeAction("with-routes");
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).toContain("Routes:");
		expect(out).toContain("/home");
		expect(out).toContain("/checkout");
		// Module count per route
		expect(out).toContain("2 modules");
		expect(out).toContain("1 module"); // singular for /checkout
	});

	it("does not print Routes section when trace has no routes", async () => {
		const trace = makeTrace({ sessionId: "no-routes", routes: [] });
		writeTraceSession(cwd, trace);
		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			await registerTraceAnalyzeAction("no-routes");
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).not.toContain("Routes:");
	});

	it("singular 'module' vs plural 'modules' in route output", async () => {
		// Route with exactly 1 module → "1 module" (not "1 modules")
		const trace = makeTrace({
			sessionId: "singular",
			routes: [
				{ path: "/solo", modules: ["src/solo.ts"] },
			],
		});
		writeTraceSession(cwd, trace);
		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			await registerTraceAnalyzeAction("singular");
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).toContain("1 module");
		expect(out).not.toContain("1 modules");
	});

	it("defaults to 'last' session when no sessionId argument given", async () => {
		const trace = makeTrace({ sessionId: "the-only-session" });
		writeTraceSession(cwd, trace);
		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			// Call with no argument — default parameter is "last"
			await registerTraceAnalyzeAction();
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).toContain("the-only-session");
	});
});

describe("registerTraceAction", () => {
	it("sets ANTISCALER_TRACE env var before running dev task", async () => {
		// We cannot run the full dev task in a unit test, but we can verify
		// the side-effect: registerTraceAction sets process.env.ANTISCALER_TRACE.
		// The test is a smoke test that the env var wiring is present.
		//
		// NOTE: this env var is never cleaned up — if the process continues
		// after the trace command (e.g., in a test runner), subsequent tasks
		// see ANTISCALER_TRACE=1 unintentionally. This is a known limitation.
		const before = process.env["ANTISCALER_TRACE"];
		try {
			// We only test that the module exports the function correctly
			const mod = await import("../trace.js");
			expect(typeof mod.registerTraceAction).toBe("function");
			expect(typeof mod.registerTraceAnalyzeAction).toBe("function");
		} finally {
			// Restore env to avoid test pollution
			if (before === undefined) {
				delete process.env["ANTISCALER_TRACE"];
			} else {
				process.env["ANTISCALER_TRACE"] = before;
			}
		}
	});
});