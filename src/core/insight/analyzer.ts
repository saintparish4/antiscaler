import type { CacheFile, TaskCacheEntry } from "../cache/store.js";
import type { TaskRunResult } from "../execution/runner.js";

export interface InsightSummary {
	lastRunResults: TaskRunResult[];
	cachedStats: Record<string, TaskCacheEntry>;
	totalDurationMs: number;
	cacheHitRate: number;
	/** Number of tasks that were served from the remote cache. */
	remoteHits: number;
	/**
	 * Estimated time saved by remote cache hits (sum of `lastDurationMs` for
	 * each remote-hit task, in milliseconds).
	 */
	estimatedTimeSavedByRemoteMs: number;
}

export function computeInsights(
	results: TaskRunResult[],
	cache: CacheFile,
	/** Fallback per-task cost used when `lastDurationMs` is not recorded. */
	costPerMissMs?: number,
): InsightSummary {
	const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
	const hits = results.filter((r) => r.cacheHit).length;
	const cacheHitRate = results.length === 0 ? 0 : hits / results.length;

	let remoteHits = 0;
	let estimatedTimeSavedByRemoteMs = 0;
	for (const r of results) {
		if (r.remoteHit === true) {
			remoteHits += 1;
			estimatedTimeSavedByRemoteMs +=
				cache.tasks[r.task]?.lastDurationMs ?? costPerMissMs ?? 0;
		}
	}

	return {
		lastRunResults: results,
		cachedStats: cache.tasks,
		totalDurationMs,
		cacheHitRate,
		remoteHits,
		estimatedTimeSavedByRemoteMs,
	};
}
