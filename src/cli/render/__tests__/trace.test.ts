import { describe, expect, it } from "vitest";
import { captureOutput } from "../../../__tests__/helpers/cli-harness.js";
import type { TraceSummary } from "../../../core/scope/trace-summary.js";
import { renderTraceSummary } from "../trace.js";

function summary(overrides: Partial<TraceSummary> = {}): TraceSummary {
	return {
		sessionId: "sess-001",
		framework: "next",
		startedAt: Date.now(),
		durationMs: 5_000,
		moduleCount: 0,
		routes: [],
		packagesTouched: 0,
		modulesByPackage: [],
		...overrides,
	};
}

describe("renderTraceSummary", () => {
	it("prints the session header fields", () => {
		const capture = captureOutput();

		renderTraceSummary(
			summary({ sessionId: "abc", framework: "vite" }),
			capture.printer,
		);

		expect(capture.stdout()).toContain("Trace session : abc");
		expect(capture.stdout()).toContain("Framework     : vite");
		expect(capture.stdout()).toContain("Duration      : 5000ms");
	});

	it("lists each route with its module count", () => {
		const capture = captureOutput();

		renderTraceSummary(
			summary({
				routes: [
					{ path: "/home", moduleCount: 2 },
					{ path: "/checkout", moduleCount: 1 },
				],
			}),
			capture.printer,
		);

		expect(capture.stdout()).toContain("/home  (2 modules)");
		expect(capture.stdout()).toContain("/checkout  (1 module)");
	});

	it("omits the routes section entirely when nothing was routed", () => {
		const capture = captureOutput();

		renderTraceSummary(summary(), capture.printer);

		expect(capture.stdout()).not.toContain("Routes:");
	});

	it("omits the packages section outside a workspace", () => {
		const capture = captureOutput();

		renderTraceSummary(summary(), capture.printer);

		expect(capture.stdout()).not.toContain("Packages touched");
	});

	it("lists the per-package module tally", () => {
		const capture = captureOutput();

		renderTraceSummary(
			summary({
				packagesTouched: 2,
				modulesByPackage: [
					{ name: "web", modules: 3 },
					{ name: "utils", modules: 1 },
				],
			}),
			capture.printer,
		);

		expect(capture.stdout()).toContain("Packages touched (2):");
		expect(capture.stdout()).toMatch(/web\s+3 modules/);
		expect(capture.stdout()).toMatch(/utils\s+1 module\b/);
	});
});
