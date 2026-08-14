import type {
	Diagnostic,
	DiagnosticLevel,
} from "../../core/doctor/diagnostics.js";
import type { Colors } from "../visuals/color.js";
import { getColors } from "../visuals/color.js";
import type { Printer } from "../visuals/printer.js";
import { getPrinter } from "../visuals/printer.js";
import { lines } from "./writer.js";

const ICON: Record<DiagnosticLevel, (colors: Colors) => string> = {
	ok: (colors) => colors.green("[✓]"),
	warn: (colors) => colors.yellow("[!]"),
	error: (colors) => colors.red("[✗]"),
};

export function renderDiagnostics(
	diagnostics: readonly Diagnostic[],
	printer: Printer = getPrinter(),
): void {
	const colors = getColors();
	for (const diagnostic of diagnostics) {
		lines(printer, `${ICON[diagnostic.level](colors)} ${diagnostic.label}`);
		if (diagnostic.detail) lines(printer, `      → ${diagnostic.detail}`);
	}
}
