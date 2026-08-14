import type { ImpactClass } from "../../core/semantic/blast-radius.js";

const LABEL_WIDTH = "non-impacting".length;

/**
 * Fixed-width so the file column lines up whatever the classification is.
 * Shared by `diff`, `pr check` and `impact` — they report the same taxonomy
 * and should look the same doing it.
 */
export function classificationLabel(classification: ImpactClass): string {
	return classification.padEnd(LABEL_WIDTH);
}

/** `1 file` / `2,048 files` — grouped digits and English pluralization. */
export function plural(count: number, noun: string): string {
	return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;
}
