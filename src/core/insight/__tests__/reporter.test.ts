import { afterEach, describe, expect, it, vi } from "vitest";
import { computeInsights } from "../analyzer.js";
import { printInsights } from "../reporter.js";

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
