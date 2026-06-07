import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiscaleError } from "../../errors.js";
import { computeInsights } from "../analyzer.js";
import { printEnv, printError, printInsights } from "../reporter.js";

describe("printInsights (insight command, cache-only path)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows Cached task history with durations for entries without hash (strict / insight)", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		printInsights(
			computeInsights([], {
				tasks: {
					typecheck: {
						lastRun: 1,
						lastDurationMs: 10,
					},
					build: {
						lastRun: 2,
						lastDurationMs: 99,
					},
				},
			}),
		);

		const combined = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(combined).toContain("Cached task history");
		expect(combined).toContain("typecheck");
		expect(combined).toContain("build");
		expect(combined).toContain("10ms");
		expect(combined).toContain("99ms");
	});
});

describe("printInsights — with run results", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints MISS status and real duration for a cache miss", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights([{ task: "build", durationMs: 1234, cacheHit: false }], {
				tasks: {},
			}),
		);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("build");
		expect(out).toContain("1234ms");
		expect(out).toContain("MISS");
	});

	it("prints HIT status and dash for duration on a cache hit", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights([{ task: "lint", durationMs: 0, cacheHit: true }], {
				tasks: {},
			}),
		);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("HIT");
		// Duration for a cache hit is displayed as "-", not "0ms"
		expect(out).toMatch(/lint\s+-\s+HIT/);
	});

	it("prints SKIP status and dash for duration on a skipped task", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights(
				[{ task: "test", durationMs: 0, cacheHit: false, skipped: true }],
				{ tasks: {} },
			),
		);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("SKIP");
		expect(out).toMatch(/test\s+-\s+SKIP/);
	});

	it("footer shows total duration and 100% hit rate when all tasks hit", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights(
				[
					{ task: "lint", durationMs: 0, cacheHit: true },
					{ task: "build", durationMs: 0, cacheHit: true },
				],
				{ tasks: {} },
			),
		);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("Total: 0ms");
		expect(out).toContain("Cache hit rate: 100%");
	});

	it("footer shows 0% hit rate when all tasks miss", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights([{ task: "build", durationMs: 500, cacheHit: false }], {
				tasks: {},
			}),
		);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("Cache hit rate: 0%");
	});

	it("shows 'No cached task data yet' when both results and cache are empty", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(computeInsights([], { tasks: {} }));
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("No cached task data yet");
	});

	it("column header width adjusts to the longest task name", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printInsights(
			computeInsights(
				[
					{ task: "a-very-long-task-name", durationMs: 100, cacheHit: false },
					{ task: "x", durationMs: 200, cacheHit: false },
				],
				{ tasks: {} },
			),
		);
		const lines = log.mock.calls.map((c) => String(c[0]));
		// Both task rows should be padded to the same width as the long name
		const taskRows = lines.filter(
			(l) => l.includes("MISS") || l.includes("HIT"),
		);
		expect(taskRows.length).toBe(2);
		// Each row should start with a string padded to the same column width
		const [row0, row1] = taskRows;
		expect(row0?.indexOf("MISS")).toBe(row1?.indexOf("MISS"));
	});
});

describe("printEnv", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints package manager, runtime, and framework", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printEnv("pnpm", { primary: "node", fallback: "node" }, "next");
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("pnpm");
		expect(out).toContain("node");
		expect(out).toContain("next");
	});

	it("prints 'none detected' when framework is null", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printEnv("npm", { primary: "node", fallback: "node" }, null);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("none detected");
	});

	it("shows runtime fallback in output", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		printEnv("yarn", { primary: "bun", fallback: "node" }, null);
		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("bun");
		expect(out).toContain("node"); // the fallback
	});
});

describe("printError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes [code] message to stderr", () => {
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		const error = new AntiscaleError("MY_CODE", "something went wrong");
		printError(error);
		const out = err.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("[MY_CODE]");
		expect(out).toContain("something went wrong");
	});

	it("writes formatted output for a ConfigError code", () => {
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		const error = new AntiscaleError("CONFIG_ERROR", "bad config");
		printError(error);
		const out = err.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("[CONFIG_ERROR]");
		expect(out).toContain("bad config");
	});
});
