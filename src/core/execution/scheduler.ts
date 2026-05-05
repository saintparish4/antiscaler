/**
 * @module
 * Event-driven task scheduler. Maintains a ready queue keyed by predicted cost
 * and wakes dependents when their last upstream finishes. Resource accounting
 * is deferred to Phase 4 (cost model); this phase ships the topology + queue.
 */

import type { TaskGraph } from "../../types/index.js";

export interface ScheduledTask {
	name: string;
	/** Lower = scheduled sooner. Phase 4 fills with cost predictions. */
	priority?: number;
}

export interface SchedulerOptions {
	concurrency: number;
	/** Optional priority lookup; default 0. */
	priorityOf?: (task: string) => number;
}

export type TaskRunner = (task: string) => Promise<void>;

export async function runScheduled(
	target: string,
	graph: TaskGraph,
	runner: TaskRunner,
	options: SchedulerOptions,
): Promise<void> {
	const levels = graph.toLevels(target);
	const allTasks = levels.flat();
	const remainingDeps = new Map<string, number>();
	const dependents = new Map<string, Set<string>>();

	for (const t of allTasks) {
		remainingDeps.set(t, 0);
		dependents.set(t, new Set());
	}
	// Reconstruct dep counts from levels: a task in level i depends on its
	// immediate upstream tasks (those reachable in levels < i).
	for (let i = 1; i < levels.length; i++) {
		for (const t of levels[i] ?? []) {
			for (const upstream of levels[i - 1] ?? []) {
				remainingDeps.set(t, (remainingDeps.get(t) ?? 0) + 1);
				const upstreamDependents = dependents.get(upstream);
				upstreamDependents?.add(t);
			}
		}
	}

	const priorityOf = options.priorityOf ?? (() => 0);
	const ready: string[] = [];
	for (const [t, n] of remainingDeps) {
		if (n === 0) ready.push(t);
	}
	ready.sort((a, b) => priorityOf(a) - priorityOf(b));

	let inFlight = 0;
	let firstError: unknown = null;

	return new Promise<void>((resolve, reject) => {
		const tryDrain = () => {
			if (firstError !== null && inFlight === 0) {
				reject(firstError);
				return;
			}
			while (
				firstError === null &&
				inFlight < options.concurrency &&
				ready.length > 0
			) {
				const next = ready.shift();
				if (next === undefined) continue;
				inFlight++;
				runner(next)
					.then(() => {
						for (const dep of dependents.get(next) ?? []) {
							const left = (remainingDeps.get(dep) ?? 0) - 1;
							remainingDeps.set(dep, left);
							if (left === 0) {
								insertSorted(ready, dep, priorityOf);
							}
						}
					})
					.catch((err) => {
						if (firstError === null) firstError = err;
					})
					.finally(() => {
						inFlight--;
						if (
							ready.length === 0 &&
							inFlight === 0 &&
							[...remainingDeps.values()].every((n) => n <= 0)
						) {
							firstError === null ? resolve() : reject(firstError);
							return;
						}
						tryDrain();
					});
			}
		};
		tryDrain();
	});
}

function insertSorted(
	arr: string[],
	item: string,
	priorityOf: (t: string) => number,
): void {
	const p = priorityOf(item);
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		const midTask = arr[mid];
		if (midTask === undefined || priorityOf(midTask) <= p) lo = mid + 1;
		else hi = mid;
	}
	arr.splice(lo, 0, item);
}
