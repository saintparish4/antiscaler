import { describe, expect, it } from "vitest";
import type { CacheFile } from "../../cache/store.js";
import { computeInsights } from "../analyzer.js";

function makeCache(entries: CacheFile["tasks"] = {}): CacheFile {
	return { tasks: entries };
}

describe("computeInsights", () => {
	it("returns zero duration and zero hit rate when results are empty", () => {
		const summary = computeInsights([], makeCache());
		expect(summary.totalDurationMs).toBe(0);
		expect(summary.cacheHitRate).toBe(0);
		expect(summary.lastRunResults).toHaveLength(0);
	});

	it("returns hit rate of 1 when all tasks are cache hits", () => {
		const results = [
			{ task: "lint", durationMs: 0, cacheHit: true },
			{ task: "build", durationMs: 0, cacheHit: true },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.cacheHitRate).toBe(1);
		expect(summary.totalDurationMs).toBe(0);
	});

	it("returns hit rate of 0 when all tasks are cache misses", () => {
		const results = [
			{ task: "lint", durationMs: 300, cacheHit: false },
			{ task: "build", durationMs: 500, cacheHit: false },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.cacheHitRate).toBe(0);
		expect(summary.totalDurationMs).toBe(800);
	});

	it("computes mixed hit rate correctly", () => {
		// 1 hit out of 4 = 0.25
		const results = [
			{ task: "typecheck", durationMs: 0, cacheHit: true },
			{ task: "lint", durationMs: 200, cacheHit: false },
			{ task: "build", durationMs: 400, cacheHit: false },
			{ task: "test", durationMs: 600, cacheHit: false },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.cacheHitRate).toBe(0.25);
		expect(summary.totalDurationMs).toBe(1200);
	});

	it("skipped tasks (skipped: true) count as misses in hit rate, contribute 0 to duration", () => {
		// A skipped task has cacheHit: false and durationMs: 0 — it does NOT
		// count as a hit, but it also does not inflate total time.
		const results = [
			{ task: "build", durationMs: 500, cacheHit: false },
			{ task: "lint", durationMs: 0, cacheHit: false, skipped: true },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.cacheHitRate).toBe(0); // no hits
		expect(summary.totalDurationMs).toBe(500); // skipped contributes 0
	});

	it("exposes cachedStats from the cache file directly", () => {
		const cache = makeCache({
			build: { hash: "abc", lastRun: 100, lastDurationMs: 250 },
		});
		const summary = computeInsights([], cache);
		expect(summary.cachedStats["build"]?.hash).toBe("abc");
		expect(summary.cachedStats["build"]?.lastDurationMs).toBe(250);
	});

	it("preserves result order in lastRunResults", () => {
		const results = [
			{ task: "lint", durationMs: 100, cacheHit: false },
			{ task: "build", durationMs: 200, cacheHit: false },
			{ task: "test", durationMs: 300, cacheHit: false },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.lastRunResults.map((r) => r.task)).toEqual([
			"lint",
			"build",
			"test",
		]);
	});

	it("remoteHits is 0 and estimatedTimeSavedByRemoteMs is 0 when no remote hits", () => {
		const results = [
			{ task: "build", durationMs: 500, cacheHit: false },
			{ task: "lint", durationMs: 0, cacheHit: true },
		];
		const summary = computeInsights(results, makeCache());
		expect(summary.remoteHits).toBe(0);
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(0);
	});

	it("counts remote hits and sums lastDurationMs from cache entries", () => {
		const cache = makeCache({
			build: { hash: "h1", lastRun: 1, lastDurationMs: 800 },
			lint: { hash: "h2", lastRun: 2, lastDurationMs: 200 },
		});
		const results = [
			{ task: "build", durationMs: 0, cacheHit: true, remoteHit: true },
			{ task: "lint", durationMs: 0, cacheHit: true, remoteHit: true },
		];
		const summary = computeInsights(results, cache);
		expect(summary.remoteHits).toBe(2);
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(1000);
	});

	it("falls back to costPerMissMs when lastDurationMs is absent for a remote hit", () => {
		// Cache entry exists but has no lastDurationMs (e.g. strict-mode task)
		const cache = makeCache({
			typecheck: { hash: "h3", lastRun: 1 },
		});
		const results = [
			{ task: "typecheck", durationMs: 0, cacheHit: true, remoteHit: true },
		];
		const summary = computeInsights(results, cache, 500);
		expect(summary.remoteHits).toBe(1);
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(500);
	});

	it("uses 0 when both lastDurationMs and costPerMissMs are absent for a remote hit", () => {
		const cache = makeCache({
			lint: { hash: "h4", lastRun: 1 },
		});
		const results = [
			{ task: "lint", durationMs: 0, cacheHit: true, remoteHit: true },
		];
		const summary = computeInsights(results, cache);
		expect(summary.remoteHits).toBe(1);
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(0);
	});

	it("prefers lastDurationMs over costPerMissMs when both are available", () => {
		const cache = makeCache({
			build: { hash: "h5", lastRun: 1, lastDurationMs: 1200 },
		});
		const results = [
			{ task: "build", durationMs: 0, cacheHit: true, remoteHit: true },
		];
		const summary = computeInsights(results, cache, 300);
		// lastDurationMs (1200) wins over costPerMissMs (300)
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(1200);
	});

	it("local cache hits (remoteHit absent) do not count toward remoteHits", () => {
		const cache = makeCache({
			build: { hash: "h6", lastRun: 1, lastDurationMs: 400 },
		});
		const results = [
			{ task: "build", durationMs: 0, cacheHit: true }, // local hit, no remoteHit
		];
		const summary = computeInsights(results, cache, 500);
		expect(summary.remoteHits).toBe(0);
		expect(summary.estimatedTimeSavedByRemoteMs).toBe(0);
	});
});
