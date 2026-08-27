/**
 * @module
 * Turns a {@link TaskProvenance} into the reason block printed under a failure.
 *
 * The only formatting code in the provenance feature — `core` captures and
 * attaches plain data, and this is where it becomes terminal text.
 *
 * Deliberately answers one question: why was this task selected to run. It says
 * nothing about why the task failed. The changed files and the failure are two
 * different signals, and a block that implied causation between them would be
 * confidently wrong every time a task was selected by one file and broke
 * because of another.
 */

import type { RunReason, TaskProvenance } from "../../types/index.js";

/** Enough of a hash to recognize, git-style; the rest is noise in a failure. */
const HASH_PREFIX_LENGTH = 7;

/** Past these, the block stops being a hint and starts being a report. */
const MAX_LISTED_FILES = 3;
const MAX_LISTED_DEPENDENTS = 5;

function shortHash(hash: string): string {
	return hash.slice(0, HASH_PREFIX_LENGTH);
}

/** `a, b, c and 4 more` — a scannable prefix, never the whole list. */
function listWithOverflow(items: readonly string[], max: number): string {
	const shown = items.slice(0, max).join(", ");
	const hidden = items.length - max;
	return hidden > 0 ? `${shown} and ${hidden} more` : shown;
}

function describeReason(reason: RunReason): string {
	if (reason.kind === "always") {
		return "this task is never cached, so it runs every time";
	}
	if (reason.kind === "cache-miss") {
		// A null expected hash is a first run, not an invalidation. Reporting it
		// as a mismatch would send the reader looking for a change that never
		// happened.
		return reason.expectedHash === null
			? "cache miss — nothing cached for this task yet"
			: `cache miss — inputs hash ${shortHash(reason.actualHash)}, cached ${shortHash(reason.expectedHash)}`;
	}
	// `affected-by` with no files means git was unavailable, not that the diff
	// was empty — an empty diff would not have put the task in scope at all.
	if (reason.changedFiles.length === 0) return "affected by the current diff";
	return `${listWithOverflow(reason.changedFiles, MAX_LISTED_FILES)} changed`;
}

/**
 * The reason block as unstyled lines, at most two of them.
 *
 * Returns plain strings so the caller owns color — this stays assertable
 * without a TTY, and there is only ever one color path.
 */
export function provenanceLines(provenance: TaskProvenance): string[] {
	const block = [`ran because: ${describeReason(provenance.reason)}`];

	const { dirtyDependents } = provenance;
	if (dirtyDependents.length > 0) {
		block.push(
			`also affected: ${listWithOverflow(dirtyDependents, MAX_LISTED_DEPENDENTS)}`,
		);
	}

	return block;
}
