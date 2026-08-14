import { describe, expect, it } from "vitest";
import { captureOutput } from "../../../__tests__/helpers/cli-harness.js";
import { renderDryRunPlan } from "../plan.js";

describe("renderDryRunPlan", () => {
	it("names the target and counts every task in the plan", () => {
		const capture = captureOutput();

		renderDryRunPlan(
			"build",
			[["lint", "typecheck"], ["build"]],
			capture.printer,
		);

		expect(capture.stdout()).toContain(
			'[dry-run] Task plan for "build" (3 task(s)):',
		);
	});

	it("lists levels in execution order, one line each", () => {
		const capture = captureOutput();

		renderDryRunPlan(
			"build",
			[["lint", "typecheck"], ["build"]],
			capture.printer,
		);

		const lines = capture.stdout().trim().split("\n");
		expect(lines[1]).toBe("  Level 1: lint, typecheck");
		expect(lines[2]).toBe("  Level 2: build");
	});

	it("prints only the header for an empty plan", () => {
		const capture = captureOutput();

		renderDryRunPlan("build", [], capture.printer);

		expect(capture.stdout().trim().split("\n")).toHaveLength(1);
		expect(capture.stdout()).toContain("(0 task(s))");
	});
});
