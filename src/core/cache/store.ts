import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
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

export function readCache(cacheDir: string): CacheFile {
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
    );
  }
}

export function writeCache(cacheDir: string, cache: CacheFile): void {
  try {
    mkdirSync(cacheDir, { recursive: true });
    const filePath = path.join(cacheDir, CACHE_FILENAME);
    writeFileSync(filePath, JSON.stringify(cache, null, 2));
  } catch (err) {
    throw new CacheError(
      `Failed to write cache to "${cacheDir}": ${String(err)}`,
    );
  }
}
