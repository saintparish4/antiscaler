import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
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
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as CacheFile;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return { tasks: {} };
		throw new CacheError(
			`Failed to read cache at "${filePath}": ${String(err)}`,
			{ cause: err },
		);
	}
}

/**
 * Written to a sibling temp file and renamed over the target. Rename is atomic
 * within a filesystem, so an interrupted run leaves the previous cache intact
 * rather than truncated JSON that `readCache` can only report as corrupt —
 * recoverable today only by deleting the cache directory by hand.
 *
 * The JSON is not indented: this is a machine artifact rewritten on every run,
 * and the whitespace costs bytes, write time, and parse time for no reader.
 */
export async function writeCache(
	cacheDir: string,
	cache: CacheFile,
): Promise<void> {
	const filePath = path.join(cacheDir, CACHE_FILENAME);
	const tempPath = temporaryPathFor(filePath);
	try {
		await mkdir(cacheDir, { recursive: true });
		await writeFile(tempPath, JSON.stringify(cache));
		await rename(tempPath, filePath);
	} catch (err) {
		await unlink(tempPath).catch(() => {});
		throw new CacheError(
			`Failed to write cache to "${cacheDir}": ${String(err)}`,
			{ cause: err },
		);
	}
}

/**
 * Synchronous variant kept solely for the process-exit safety net in
 * runner.ts. Do NOT use this in normal code paths -- prefer `writeCache`.
 *
 * This is the path most likely to be interrupted, so it needs the temp-file
 * rename of `writeCache` more than `writeCache` does.
 */
export function writeCacheSync(cacheDir: string, cache: CacheFile): void {
	const filePath = path.join(cacheDir, CACHE_FILENAME);
	const tempPath = temporaryPathFor(filePath);
	try {
		mkdirSync(cacheDir, { recursive: true });
		writeFileSync(tempPath, JSON.stringify(cache));
		renameSync(tempPath, filePath);
	} catch (err) {
		try {
			unlinkSync(tempPath);
		} catch {
			// Nothing to clean up, or we cannot -- the original error matters more.
		}
		throw new CacheError(
			`Failed to write cache to "${cacheDir}": ${String(err)}`,
			{ cause: err },
		);
	}
}

/**
 * A sibling of the target, so the rename never crosses a filesystem boundary
 * (where it would stop being atomic). The pid and counter keep two writers --
 * including this process's own async write racing its exit handler -- off
 * each other's temp file.
 */
let temporaryCounter = 0;
function temporaryPathFor(filePath: string): string {
	return `${filePath}.${process.pid}.${temporaryCounter++}.tmp`;
}

/**
 * Returns a new CacheFile with entries whose `lastRun` is older than
 * `ttlDays` days removed. Does not mutate the original.
 */
export function evictStaleEntries(
	cache: CacheFile,
	ttlDays: number,
): CacheFile {
	const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1_000;
	const tasks: CacheFile["tasks"] = {};
	for (const [name, entry] of Object.entries(cache.tasks)) {
		if (entry.lastRun >= cutoff) {
			tasks[name] = entry;
		}
	}
	return { tasks };
}
