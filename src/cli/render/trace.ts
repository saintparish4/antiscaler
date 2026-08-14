import type { TraceSummary } from "../../core/scope/trace-summary.js";
import type { Printer } from "../visuals/printer.js";
import { getPrinter } from "../visuals/printer.js";
import { plural } from "./labels.js";
import { lines } from "./writer.js";

const PACKAGE_COLUMN_WIDTH = 32;

export function renderTraceSummary(
	summary: TraceSummary,
	printer: Printer = getPrinter(),
): void {
	lines(
		printer,
		"",
		`Trace session : ${summary.sessionId}`,
		`Framework     : ${summary.framework}`,
		`Started       : ${new Date(summary.startedAt).toLocaleString()}`,
		`Duration      : ${summary.durationMs}ms`,
		`Modules       : ${summary.moduleCount}`,
		`Routes        : ${summary.routes.length}`,
	);

	if (summary.routes.length > 0) {
		lines(printer, "", "Routes:");
		for (const route of summary.routes) {
			lines(
				printer,
				`  ${route.path}  (${plural(route.moduleCount, "module")})`,
			);
		}
	}

	if (summary.modulesByPackage.length > 0) {
		lines(printer, "", `Packages touched (${summary.packagesTouched}):`);
		for (const pkg of summary.modulesByPackage) {
			lines(
				printer,
				`  ${pkg.name.padEnd(PACKAGE_COLUMN_WIDTH)} ${plural(pkg.modules, "module")}`,
			);
		}
	}
}
