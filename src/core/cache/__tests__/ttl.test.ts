import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evictStaleEntries } from "../store.js";

const NOW = new Date("2026-06-08T12:00:00Z").getTime();
const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("evictStaleEntries", () => {
	it("removes entries older than ttlDays", () => {
		const stale = NOW - 7 * ONE_DAY_MS; // 7 days ago
		const fresh = NOW - 1 * ONE_DAY_MS; // 1 day ago
		const cache = {
			tasks: {
				stale: { hash: "a", lastRun: stale, lastDurationMs: 100 },
				fresh: { hash: "b", lastRun: fresh, lastDurationMs: 200 },
			},
		};
		const result = evictStaleEntries(cache, 3);
		expect(result.tasks["stale"]).toBeUndefined();
		expect(result.tasks["fresh"]).toBeDefined();
	});

	it("keeps all entries when none are expired", () => {
		const recent = NOW - 60_000; // 1 minute ago
		const cache = {
			tasks: { build: { hash: "c", lastRun: recent } },
		};
		const result = evictStaleEntries(cache, 1);
		expect(result.tasks["build"]).toBeDefined();
	});

	it("returns empty tasks when all entries are expired", () => {
		const veryOld = new Date("2025-01-01T00:00:00Z").getTime();
		const cache = {
			tasks: { lint: { hash: "d", lastRun: veryOld } },
		};
		const result = evictStaleEntries(cache, 30);
		expect(Object.keys(result.tasks)).toHaveLength(0);
	});

	it("keeps entry whose lastRun is exactly at the cutoff boundary", () => {
		const cutoffMs = 3 * ONE_DAY_MS;
		// Exactly at the cutoff — should be kept (>= cutoff)
		const atCutoff = NOW - cutoffMs;
		const cache = {
			tasks: { build: { hash: "e", lastRun: atCutoff } },
		};
		const result = evictStaleEntries(cache, 3);
		expect(result.tasks["build"]).toBeDefined();
	});

	it("does not mutate the original cache object", () => {
		const stale = NOW - 10 * ONE_DAY_MS;
		const cache = {
			tasks: { old: { hash: "f", lastRun: stale } },
		};
		evictStaleEntries(cache, 1);
		expect(cache.tasks["old"]).toBeDefined();
	});

	it("handles empty cache without errors", () => {
		const result = evictStaleEntries({ tasks: {} }, 7);
		expect(result.tasks).toEqual({});
	});
});
