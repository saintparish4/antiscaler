/**
 * @module
 * Builds the per-task provenance map: why each task was selected to run.
 *
 * Every field here is a byproduct of work `createContext()` already does — the
 * DAG it built and the git diff it computed — so capture is a lookup, never a
 * second traversal.
 */

import type {
	RunReason,
	Strategy,
	TaskConfig,
	TaskGraph,
	TaskProvenance,
} from "../../types/index.js";

export interface ProvenanceInput {
	tasks: Record<string, TaskConfig>;
	graph: TaskGraph;
	strategy: Strategy;
	/** Files in the current diff. Undefined when git is unavailable. */
	changedFiles?: string[];
	/** Packages the diff marks affected, cascade included. */
	affectedPackages?: ReadonlySet<string>;
}

/**
 * Workspace tasks are named `<package>:<script>` (see `tasksFromPackageGraph`).
 * Split on the LAST colon so scoped names like `@acme/web:build` survive.
 * Returns undefined for a plain top-level task, which belongs to no package.
 */
export function packageOfTask(taskId: string): string | undefined {
	const separator = taskId.lastIndexOf(":");
	return separator === -1 ? undefined : taskId.slice(0, separator);
}

/**
 * Mirrors the runner's own cacheability test (`!isStrict && patterns.length`).
 * An uncacheable task never reaches a hash comparison, so "it always runs" is
 * the most specific reason that exists for it.
 */
function isAlwaysRun(strategy: Strategy, task: TaskConfig): boolean {
	return strategy === "strict" || (task.inputs?.length ?? 0) === 0;
}

/**
 * A task is dirty when the diff touches its package. With no diff information
 * at all, assume dirty — over-reporting a dependent is a cosmetic error, while
 * under-reporting hides the one task the reader needed to see.
 */
function isDirty(taskId: string, affected: ReadonlySet<string> | undefined) {
	if (affected === undefined) return true;
	const owner = packageOfTask(taskId);
	return owner === undefined || affected.has(owner);
}

/** `task -> tasks that depend on it`, the reverse of the DAG's own edges. */
function reverseAdjacency(
	tasks: Record<string, TaskConfig>,
	graph: TaskGraph,
): Map<string, string[]> {
	const dependents = new Map<string, string[]>();
	for (const taskId of Object.keys(tasks)) {
		for (const upstream of graph.getDependencies(taskId)) {
			const existing = dependents.get(upstream);
			if (existing === undefined) dependents.set(upstream, [taskId]);
			else existing.push(taskId);
		}
	}
	return dependents;
}

function seedReason(taskId: string, input: ProvenanceInput): RunReason {
	const task = input.tasks[taskId] ?? {};
	if (isAlwaysRun(input.strategy, task)) return { kind: "always" };
	// A cacheable task is only a candidate because the diff put it in scope.
	// The runner replaces this with the precise `cache-miss` (carrying both
	// hashes) at the moment it observes the mismatch — see recordCacheMiss.
	return { kind: "affected-by", changedFiles: [...(input.changedFiles ?? [])] };
}

export function buildProvenance(
	input: ProvenanceInput,
): Map<string, TaskProvenance> {
	const dependents = reverseAdjacency(input.tasks, input.graph);
	const provenance = new Map<string, TaskProvenance>();

	for (const taskId of Object.keys(input.tasks)) {
		provenance.set(taskId, {
			taskId,
			reason: seedReason(taskId, input),
			// Sorted so a reason block never reorders between identical runs.
			dirtyDependents: (dependents.get(taskId) ?? [])
				.filter((dependent) => isDirty(dependent, input.affectedPackages))
				.sort(),
			upstreamTasks: [...input.graph.getDependencies(taskId)].sort(),
		});
	}

	return provenance;
}

/**
 * Upgrades a task's reason to `cache-miss` once the runner has both hashes.
 * `expectedHash` is null when nothing was cached for this task at all, which
 * is a first run rather than an invalidation — a distinction worth keeping.
 */
export function recordCacheMiss(
	provenance: Map<string, TaskProvenance> | undefined,
	taskId: string,
	expectedHash: string | null,
	actualHash: string,
): void {
	const existing = provenance?.get(taskId);
	if (existing === undefined) return;
	existing.reason = { kind: "cache-miss", expectedHash, actualHash };
}
