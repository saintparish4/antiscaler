/**
 * Why a task was selected to run — cache-miss, affected-by-diff, or always-run.
 *
 * Deliberately NOT an explanation of why a task's assertions failed. The two
 * are different signals, and conflating them produces confident-sounding wrong
 * answers: a task can be selected because `db.ts` changed and then fail for a
 * reason that has nothing to do with `db.ts`.
 */
export type RunReason =
	/** `expectedHash` is null when nothing was cached yet — a first run, not
	 * an invalidation. The two look identical once flattened to a string. */
	| { kind: "cache-miss"; expectedHash: string | null; actualHash: string }
	| { kind: "affected-by"; changedFiles: string[] }
	/** The task has no cache key, or strict mode opts it out of caching. */
	| { kind: "always" };

/**
 * Cache/graph provenance for a single task in a single run.
 *
 * Plain data: no formatting, no terminal strings. Anything printable belongs to
 * the reporter, which is what keeps `core`'s "never prints" rule intact and
 * lets this be asserted on without a TTY.
 */
export interface TaskProvenance {
	taskId: string;
	reason: RunReason;
	/** Sibling DAG nodes also invalidated this run. */
	dirtyDependents: string[];
	/** DAG parents that produced the inputs this task hashed. */
	upstreamTasks: string[];
}
