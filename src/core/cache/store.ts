import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CacheError } from "../errors.js";

export interface TaskCacheEntry {
	/** Absent when the run had no inputs or used strict strategy. */
	hash?: string;
	lastRun: number;
	lastDurationMs?: number;
}

export interface CacheFile {
	tasks: Record<string, TaskCacheEntry>;
}

const CACHE_FILENAME = "cache.json";

export async function readCache(cacheDir: string): Promise<CacheFile> {
	const filePath = path.join(cacheDir, CACHE_FILENAME);
	if (!existsSync(filePath)) {
		return { tasks: {} };
	}
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as CacheFile;
	} catch (err) {
		throw new CacheError(
			`Failed to read cache at "${filePath}": ${String(err)}`,
			{ cause: err },
		);
	}
}

export async function writeCache(
	cacheDir: string,
	cache: CacheFile,
): Promise<void> {
	try {
		await mkdir(cacheDir, { recursive: true });
		const filePath = path.join(cacheDir, CACHE_FILENAME);
		await writeFile(filePath, JSON.stringify(cache, null, 2));
	} catch (err) {
		throw new CacheError(
			`Failed to write cache to "${cacheDir}": ${String(err)}`,
			{ cause: err },
		);
	}
}

/**
 * Synchronous variant kept solely for the process-exit safety net in
 * runner.ts. Do NOT use this in normal code paths -- prefer `writeCache`.
 */
export function writeCacheSync(cacheDir: string, cache: CacheFile): void {
	try {
		mkdirSync(cacheDir, { recursive: true });
		const filePath = path.join(cacheDir, CACHE_FILENAME);
		writeFileSync(filePath, JSON.stringify(cache, null, 2));
	} catch (err) {
		throw new CacheError(
			`Failed to write cache to "${cacheDir}": ${String(err)}`,
			{ cause: err },
		);
	}
}

/**
 * Synchronous variant kept symmetric with writeCacheSync. Used only by
 * code paths that cannot be async (currently: none -- reserved).
 */
export function readCacheSync(cacheDir: string): CacheFile {
	const filePath = path.join(cacheDir, CACHE_FILENAME);
	if (!existsSync(filePath)) {
		return { tasks: {} };
	}
	try {
		const raw = readFileSync(filePath, "utf8");
		return JSON.parse(raw) as CacheFile;
	} catch (err) {
		throw new CacheError(
			`Failed to read cache at "${filePath}": ${String(err)}`,
			{ cause: err },
		);
	}
}
