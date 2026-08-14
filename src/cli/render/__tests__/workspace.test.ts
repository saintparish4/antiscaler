import { describe, expect, it } from "vitest";
import { captureOutput } from "../../../__tests__/helpers/cli-harness.js";
import type { WorkspaceViolation } from "../../../core/graph/workspace-check.js";
import { renderWorkspaceCheck } from "../workspace.js";

function violation(
	overrides: Partial<WorkspaceViolation> = {},
): WorkspaceViolation {
	return {
		kind: "undeclared-workspace-dep",
		package: "@org/web",
		target: "@org/auth",
		files: ["apps/web/src/page.ts"],
		...overrides,
	};
}

describe("renderWorkspaceCheck", () => {
	it("reports a clean workspace", () => {
		const capture = captureOutput();

		renderWorkspaceCheck(
			{ packagesChecked: 3, violations: [] },
			capture.printer,
		);

		expect(capture.stdout()).toContain("Checked 3 packages.");
		expect(capture.stdout()).toContain("No dependency violations found.");
	});

	it("uses the singular for a single package", () => {
		const capture = captureOutput();

		renderWorkspaceCheck(
			{ packagesChecked: 1, violations: [] },
			capture.printer,
		);

		expect(capture.stdout()).toContain("Checked 1 package.");
	});

	it("explains an undeclared workspace dependency", () => {
		const capture = captureOutput();

		renderWorkspaceCheck(
			{ packagesChecked: 2, violations: [violation()] },
			capture.printer,
		);

		expect(capture.stdout()).toContain(
			"@org/web imports @org/auth but does not declare it",
		);
		expect(capture.stdout()).toContain("apps/web/src/page.ts");
		expect(capture.stdout()).toContain("1 violation found.");
	});

	it("explains an undeclared external dependency", () => {
		const capture = captureOutput();

		renderWorkspaceCheck(
			{
				packagesChecked: 1,
				violations: [
					violation({ kind: "undeclared-external-dep", target: "lodash" }),
				],
			},
			capture.printer,
		);

		expect(capture.stdout()).toContain("neither it nor the workspace root");
	});

	it("explains a cross-package relative import", () => {
		const capture = captureOutput();

		renderWorkspaceCheck(
			{
				packagesChecked: 1,
				violations: [violation({ kind: "cross-package-relative-import" })],
			},
			capture.printer,
		);

		expect(capture.stdout()).toContain("bypasses its public entry");
	});

	it("truncates long file lists and says how many were hidden", () => {
		const files = Array.from({ length: 8 }, (_, i) => `src/file-${i}.ts`);
		const capture = captureOutput();

		renderWorkspaceCheck(
			{ packagesChecked: 1, violations: [violation({ files })] },
			capture.printer,
		);

		expect(capture.stdout()).toContain("src/file-4.ts");
		expect(capture.stdout()).not.toContain("src/file-5.ts");
		expect(capture.stdout()).toContain("… and 3 more file(s)");
	});
});
