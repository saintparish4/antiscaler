import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CacheError } from "../../errors.js";
import {
	readCache,
	readCacheSync,
	writeCache,
	writeCacheSync,
} from "../store.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "link-store-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
});

describe("readCache", () => {
	it("returns empty tasks when cache dir does not exist", async () => {
		const dir = path.join(makeTmpDir(), "nonexistent");
		const cache = await readCache(dir);
		expect(cache).toEqual({ tasks: {} });
	});

	it("returns empty tasks when cache file does not exist", async () => {
		const dir = makeTmpDir();
		const cache = await readCache(dir);
		expect(cache).toEqual({ tasks: {} });
	});

	it("reads and parses a valid cache file", async () => {
		const dir = makeTmpDir();
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			path.join(dir, "cache.json"),
			JSON.stringify({ tasks: { build: { hash: "abc", lastRun: 123 } } }),
		);
		const cache = await readCache(dir);
		expect(cache.tasks["build"]?.hash).toBe("abc");
		expect(cache.tasks["build"]?.lastRun).toBe(123);
	});

	it("throws CacheError on malformed JSON", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "cache.json"), "NOT JSON{{{");
		await expect(readCache(dir)).rejects.toBeInstanceOf(CacheError);
	});

	it("CacheError preserves cause", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "cache.json"), "BROKEN");
		try {
			await readCache(dir);
		} catch (err) {
			expect(err).toBeInstanceOf(CacheError);
			expect((err as CacheError).cause).toBeDefined();
		}
	});
});

describe("writeCache", () => {
	it("creates directory and writes valid JSON", async () => {
		const dir = path.join(makeTmpDir(), "nested", "cache");
		await writeCache(dir, { tasks: { t: { lastRun: 1 } } });
		const result = await readCache(dir);
		expect(result.tasks["t"]?.lastRun).toBe(1);
	});

	it("round-trip: write then read returns equal data", async () => {
		const dir = makeTmpDir();
		const data = {
			tasks: {
				build: { hash: "h1", lastRun: 100, lastDurationMs: 50 },
				lint: { lastRun: 200 },
			},
		};
		await writeCache(dir, data);
		const result = await readCache(dir);
		expect(result).toEqual(data);
	});
});

describe("readCacheSync / writeCacheSync", () => {
	it("round-trip works synchronously", () => {
		const dir = path.join(makeTmpDir(), "sync-cache");
		writeCacheSync(dir, { tasks: { x: { lastRun: 99 } } });
		const result = readCacheSync(dir);
		expect(result.tasks["x"]?.lastRun).toBe(99);
	});

	it("readCacheSync returns empty on missing dir", () => {
		const dir = path.join(makeTmpDir(), "nope");
		const result = readCacheSync(dir);
		expect(result).toEqual({ tasks: {} });
	});

	it("writeCacheSync creates directory recursively", () => {
		const dir = path.join(makeTmpDir(), "a", "b", "c");
		writeCacheSync(dir, { tasks: {} });
		const result = readCacheSync(dir);
		expect(result).toEqual({ tasks: {} });
	});
});
