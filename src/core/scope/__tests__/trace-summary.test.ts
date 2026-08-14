import { describe, expect, it } from "vitest";
import type { TraceFile } from "../../../tracer/types.js";
import type { PackageGraph } from "../../graph/package-graph.js";
import { summarizeTrace } from "../trace-summary.js";

function trace(overrides: Partial<TraceFile> = {}): TraceFile {
	return {
		schemaVersion: 1,
		sessionId: "sess-001",
		startedAt: 1_000,
		endedAt: 6_000,
		framework: "next",
		modules: [],
		routes: [],
		...overrides,
	};
}

function packageGraph(
	packages: Array<{ name: string; dir: string }>,
): PackageGraph {
	return {
		packages: packages.map(({ name, dir }) => ({
			name,
			dir,
			manifest: { name },
		})),
		edges: new Map(),
	};
}

const NO_PACKAGES = packageGraph([]);

describe("summarizeTrace", () => {
	it("carries the session identity through unchanged", () => {
		const summary = summarizeTrace(
			trace({ sessionId: "abc", framework: "vite" }),
			NO_PACKAGES,
		);

		expect(summary.sessionId).toBe("abc");
		expect(summary.framework).toBe("vite");
		expect(summary.startedAt).toBe(1_000);
	});

	it("computes duration from the session's start and end", () => {
		expect(summarizeTrace(trace(), NO_PACKAGES).durationMs).toBe(5_000);
	});

	it("counts modules per route", () => {
		const summary = summarizeTrace(
			trace({
				routes: [
					{ path: "/home", modules: ["a.ts", "b.ts"] },
					{ path: "/checkout", modules: ["c.ts"] },
				],
			}),
			NO_PACKAGES,
		);

		expect(summary.routes).toEqual([
			{ path: "/home", moduleCount: 2 },
			{ path: "/checkout", moduleCount: 1 },
		]);
	});

	it("reports no package breakdown when there is no workspace graph", () => {
		const summary = summarizeTrace(
			trace({ modules: [{ file: "/repo/src/a.ts" }] }),
			NO_PACKAGES,
		);

		expect(summary.moduleCount).toBe(1);
		expect(summary.modulesByPackage).toEqual([]);
		expect(summary.packagesTouched).toBe(0);
	});

	it("tallies modules per owning package", () => {
		const summary = summarizeTrace(
			trace({
				modules: [
					{ file: "/repo/packages/web/a.ts" },
					{ file: "/repo/packages/web/b.ts" },
					{ file: "/repo/packages/utils/c.ts" },
				],
			}),
			packageGraph([
				{ name: "web", dir: "/repo/packages/web" },
				{ name: "utils", dir: "/repo/packages/utils" },
			]),
		);

		expect(summary.modulesByPackage).toEqual([
			{ name: "web", modules: 2 },
			{ name: "utils", modules: 1 },
		]);
		expect(summary.packagesTouched).toBe(2);
	});

	it("orders the breakdown by module count, busiest first", () => {
		const summary = summarizeTrace(
			trace({
				modules: [
					{ file: "/repo/packages/small/a.ts" },
					{ file: "/repo/packages/big/a.ts" },
					{ file: "/repo/packages/big/b.ts" },
				],
			}),
			packageGraph([
				{ name: "small", dir: "/repo/packages/small" },
				{ name: "big", dir: "/repo/packages/big" },
			]),
		);

		expect(summary.modulesByPackage.map((p) => p.name)).toEqual([
			"big",
			"small",
		]);
	});

	it("attributes each module to a single package", () => {
		const summary = summarizeTrace(
			trace({ modules: [{ file: "/repo/packages/web/a.ts" }] }),
			packageGraph([
				{ name: "web", dir: "/repo/packages/web" },
				{ name: "root", dir: "/repo/packages" },
			]),
		);

		expect(summary.modulesByPackage).toEqual([{ name: "web", modules: 1 }]);
	});
});
