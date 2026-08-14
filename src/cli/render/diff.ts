import type {
	ClassifyResult,
	SemanticClass,
} from "../../core/semantic/differ.js";
import type { Printer } from "../visuals/printer.js";
import { getPrinter } from "../visuals/printer.js";
import { lines } from "./writer.js";

const CLASS_MEANING: Record<SemanticClass, string> = {
	"non-impacting": "safe to skip build",
	internal: "implementation-only change",
	breaking: "exported API changed",
};

export function renderClassification(
	result: ClassifyResult,
	baseRef: string,
	printer: Printer = getPrinter(),
): void {
	const meaning = `${result.classification.padEnd(15)}(${CLASS_MEANING[result.classification]})`;
	lines(
		printer,
		"",
		`File:           ${result.filePath}`,
		`Base ref:       ${baseRef}`,
		`Classification: ${meaning}`,
		`Confidence:     ${Math.round(result.confidence * 100)}%`,
	);

	const { added, removed, changed } = result.exportedSymbols;
	if (added.length > 0 || removed.length > 0 || changed.length > 0) {
		lines(printer, "", "Exported symbol changes:");
		if (added.length > 0) lines(printer, `  added:   ${added.join(", ")}`);
		if (removed.length > 0) lines(printer, `  removed: ${removed.join(", ")}`);
		if (changed.length > 0) {
			const detail = changed.map((c) => `${c.name} [${c.kind}]`).join(", ");
			lines(printer, `  changed: ${detail}`);
		}
	}

	if (result.confidenceNotes.length > 0) {
		lines(printer, "", "Confidence lowered by:");
		for (const note of result.confidenceNotes) lines(printer, `  - ${note}`);
	}
}
