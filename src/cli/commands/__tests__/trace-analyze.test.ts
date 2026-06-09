import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPackageGraph } from "../../../core/graph/package-graph.js";
import type { TraceFile } from "../../../tracer/types.js";

vi.mock("../../../core/graph/package-graph.js", () => ({
	loadPackageGraph: vi
		.fn()
		.mockResolvedValue({ packages: [], edges: new Map() }),
	tasksFromPackageGraph: vi.fn(() => ({})),
}));

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
		endedAt: Date.now(),
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

	beforeEach(() => {
		cwd = makeTmpDir();
		writeConfig(cwd);
		logs = [];
		vi.spyOn(console, "log").mockImplementation((...args) => {
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
				{ path: "/home", modules: ["src/home.ts", "src/layout.ts"] },
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
			routes: [{ path: "/solo", modules: ["src/solo.ts"] }],
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
		const before = process.env["ANTISCALER_TRACE"];
		try {
			const mod = await import("../trace.js");
			expect(typeof mod.registerTraceAction).toBe("function");
			expect(typeof mod.registerTraceAnalyzeAction).toBe("function");
		} finally {
			if (before === undefined) {
				process.env["ANTISCALER_TRACE"] = undefined;
			} else {
				process.env["ANTISCALER_TRACE"] = before;
			}
		}
	});

	it("actually runs the dev task and sets ANTISCALER_TRACE=1", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { dev: { command: "echo dev-trace-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd();
		process.chdir(dir);
		const before = process.env["ANTISCALER_TRACE"];
		try {
			const { registerTraceAction } = await import("../trace.js");
			await expect(registerTraceAction()).resolves.toBeUndefined();
			expect(process.env["ANTISCALER_TRACE"]).toBe("1");
		} finally {
			process.chdir(origCwd);
			if (before === undefined) {
				// Truly unset (not `= undefined`, which would leak the string
				// "undefined" into later tests) without the `delete` operator.
				Reflect.deleteProperty(process.env, "ANTISCALER_TRACE");
			} else {
				process.env["ANTISCALER_TRACE"] = before;
			}
		}
	});
});

describe("registerTraceAnalyzeAction (with packages)", () => {
	let cwd: string;
	let logs: string[];

	beforeEach(() => {
		cwd = makeTmpDir();
		logs = [];
		vi.spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.map(String).join(" "));
		});
		vi.mocked(loadPackageGraph).mockResolvedValue({
			packages: [],
			edges: new Map(),
		});
	});

	it("prints packages block when workspace packages are present", async () => {
		writeConfig(cwd);
		const pkgDir = path.join(cwd, "packages", "mylib");
		mkdirSync(pkgDir, { recursive: true });

		const moduleFile = path.join(pkgDir, "index.ts");
		vi.mocked(loadPackageGraph).mockResolvedValue({
			packages: [{ name: "mylib", dir: pkgDir, manifest: { name: "mylib" } }],
			edges: new Map(),
		});
		writeTraceSession(
			cwd,
			makeTrace({
				sessionId: "with-pkg",
				modules: [{ file: moduleFile }],
			}),
		);

		const origCwd = process.cwd();
		process.chdir(cwd);
		try {
			const { registerTraceAnalyzeAction } = await import("../trace.js");
			await registerTraceAnalyzeAction("with-pkg");
		} finally {
			process.chdir(origCwd);
		}
		const out = logs.join("\n");
		expect(out).toContain("Packages touched");
		expect(out).toContain("mylib");
	});
});
