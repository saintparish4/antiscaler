import type {
	WorkspaceCheckResult,
	WorkspaceViolation,
	WorkspaceViolationKind,
} from "../../core/graph/workspace-check.js";
import type { Printer } from "../visuals/printer.js";
import { getPrinter } from "../visuals/printer.js";
import { plural } from "./labels.js";
import { lines } from "./writer.js";

const MAX_FILES_SHOWN = 5;

export const NO_WORKSPACE_MESSAGE =
	"workspace check: no workspace packages found (pnpm-workspace.yaml or package.json `workspaces` required).";

const DESCRIBE: Record<
	WorkspaceViolationKind,
	(violation: WorkspaceViolation) => string
> = {
	"undeclared-workspace-dep": (v) =>
		`${v.package} imports ${v.target} but does not declare it`,
	"undeclared-external-dep": (v) =>
		`${v.package} imports ${v.target} but neither it nor the workspace root declares it`,
	"cross-package-relative-import": (v) =>
		`${v.package} reaches into ${v.target} via a relative import (bypasses its public entry)`,
};

export function renderWorkspaceCheck(
	result: WorkspaceCheckResult,
	printer: Printer = getPrinter(),
): void {
	lines(printer, "", `Checked ${plural(result.packagesChecked, "package")}.`);

	if (result.violations.length === 0) {
		lines(printer, "", "No dependency violations found.");
		return;
	}

	lines(printer, "");
	for (const violation of result.violations) {
		lines(printer, `  ✗ ${DESCRIBE[violation.kind](violation)}`);
		for (const file of violation.files.slice(0, MAX_FILES_SHOWN)) {
			lines(printer, `      ${file}`);
		}
		if (violation.files.length > MAX_FILES_SHOWN) {
			lines(
				printer,
				`      … and ${violation.files.length - MAX_FILES_SHOWN} more file(s)`,
			);
		}
	}

	lines(printer, "", `${plural(result.violations.length, "violation")} found.`);
}
