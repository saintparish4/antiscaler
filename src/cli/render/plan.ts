import type { Printer } from "../visuals/printer.js";
import { getPrinter } from "../visuals/printer.js";
import { lines } from "./writer.js";

/**
 * The `--dry-run` view of a task graph: one line per DAG level, in the order
 * the runner would execute them.
 */
export function renderDryRunPlan(
	target: string,
	levels: readonly string[][],
	printer: Printer = getPrinter(),
): void {
	lines(
		printer,
		`[dry-run] Task plan for "${target}" (${levels.flat().length} task(s)):`,
	);
	for (const [index, level] of levels.entries()) {
		lines(printer, `  Level ${index + 1}: ${level.join(", ")}`);
	}
}
