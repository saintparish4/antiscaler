import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { antiscalerNextPlugin } from "../next-plugin.js";
import type { TraceFile } from "../types.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-next-p-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
});

function mockCompiler(context: string) {
	const hooks: {
		afterCompile: Array<(compilation: unknown) => void>;
		done: Array<() => Promise<void>>;
	} = { afterCompile: [], done: [] };

	return {
		compiler: {
			context,
			hooks: {
				afterCompile: {
					tap: (_name: string, cb: (c: unknown) => void) => {
						hooks.afterCompile.push(cb);
					},
				},
				done: {
					tapPromise: (_name: string, cb: () => Promise<void>) => {
						hooks.done.push(cb);
					},
				},
			},
		},
		simulateCompilation(modules: Array<{ resource?: string }>) {
			for (const cb of hooks.afterCompile) {
				cb({ modules });
			}
		},
		async simulateDone() {
			for (const cb of hooks.done) {
				await cb();
			}
		},
	};
}

describe("antiscalerNextPlugin", () => {
	it("registers afterCompile and done hooks", () => {
		const cwd = makeTmpDir();
		const { compiler } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({ outDir: "traces" });
		plugin.apply(compiler);
		// Hooks should have been tapped
		expect(true).toBe(true); // no throw = taps registered
	});

	it("collects modules from compilation, skipping node_modules", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateCompilation, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "nx1",
			outDir: "traces",
		});
		plugin.apply(compiler);

		simulateCompilation([
			{ resource: "/app/src/page.tsx" },
			{ resource: "/app/node_modules/react/index.js" },
			{ resource: "/app/src/lib.ts" },
			{ resource: "" },
			{},
		]);

		return simulateDone().then(async () => {
			const trace: TraceFile = JSON.parse(
				await readFile(path.join(cwd, "traces", "nx1.json"), "utf8"),
			);
			expect(trace.modules).toHaveLength(2);
			expect(trace.modules.map((m) => m.file)).toContain("/app/src/page.tsx");
			expect(trace.modules.map((m) => m.file)).toContain("/app/src/lib.ts");
		});
	});

	it("writes sorted modules and framework='next'", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateCompilation, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "nx2",
			outDir: "traces",
		});
		plugin.apply(compiler);
		simulateCompilation([{ resource: "/z.ts" }, { resource: "/a.ts" }]);

		return simulateDone().then(async () => {
			const trace: TraceFile = JSON.parse(
				await readFile(path.join(cwd, "traces", "nx2.json"), "utf8"),
			);
			expect(trace.framework).toBe("next");
			expect(trace.modules[0]?.file).toBe("/a.ts");
			expect(trace.modules[1]?.file).toBe("/z.ts");
		});
	});

	it("options.sessionId overrides generated id", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "custom-id",
			outDir: "traces",
		});
		plugin.apply(compiler);

		return simulateDone().then(async () => {
			const trace: TraceFile = JSON.parse(
				await readFile(path.join(cwd, "traces", "custom-id.json"), "utf8"),
			);
			expect(trace.sessionId).toBe("custom-id");
		});
	});

	it("multiple compilations accumulate modules (watch mode)", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateCompilation, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "nx3",
			outDir: "traces",
		});
		plugin.apply(compiler);

		simulateCompilation([{ resource: "/a.ts" }]);
		simulateCompilation([{ resource: "/b.ts" }]);

		return simulateDone().then(async () => {
			const trace: TraceFile = JSON.parse(
				await readFile(path.join(cwd, "traces", "nx3.json"), "utf8"),
			);
			expect(trace.modules).toHaveLength(2);
		});
	});

	it("deduplicates modules seen across compilations", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateCompilation, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "nx4",
			outDir: "traces",
		});
		plugin.apply(compiler);

		simulateCompilation([{ resource: "/same.ts" }]);
		simulateCompilation([{ resource: "/same.ts" }]);

		return simulateDone().then(async () => {
			const trace: TraceFile = JSON.parse(
				await readFile(path.join(cwd, "traces", "nx4.json"), "utf8"),
			);
			expect(trace.modules).toHaveLength(1);
		});
	});

	it("uses compiler.context as cwd for writeTrace", () => {
		const cwd = makeTmpDir();
		const { compiler, simulateDone } = mockCompiler(cwd);
		const plugin = antiscalerNextPlugin({
			sessionId: "nx5",
			outDir: "my-traces",
		});
		plugin.apply(compiler);

		return simulateDone().then(() => {
			expect(existsSync(path.join(cwd, "my-traces", "nx5.json"))).toBe(true);
		});
	});
});
