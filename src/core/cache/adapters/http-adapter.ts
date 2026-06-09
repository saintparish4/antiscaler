import { CacheError } from "../../errors.js";
import type { RemoteCacheAdapter } from "../remote-adapter.js";

export interface HttpCacheAdapterOptions {
	/** Base URL of the cache endpoint. Keys are appended as path segments. */
	url: string;
	/** Extra HTTP headers (e.g. Authorization tokens). */
	headers?: Record<string, string>;
	/** Request timeout in milliseconds. Default: 10 000. */
	timeout?: number;
	/**
	 * Maximum response body size in bytes for a GET. Guards against a hostile
	 * or buggy endpoint exhausting memory. Default: 1 MiB (entries are small
	 * JSON metadata blobs, never build artifacts).
	 */
	maxResponseBytes?: number;
}

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

export function createHttpCacheAdapter(
	options: HttpCacheAdapterOptions,
): RemoteCacheAdapter {
	const {
		url,
		headers = {},
		timeout = 10_000,
		maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
	} = options;
	const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;

	async function req(
		method: string,
		key: string,
		body?: Uint8Array,
	): Promise<Response> {
		try {
			return await fetch(`${baseUrl}/${key}`, {
				method,
				headers: {
					...headers,
					...(body !== undefined
						? { "Content-Type": "application/octet-stream" }
						: {}),
				},
				...(body !== undefined ? { body } : {}),
				signal: AbortSignal.timeout(timeout),
			});
		} catch (err) {
			throw new CacheError(
				`Remote cache ${method} failed for key "${key}": ${String(err)}`,
				{ cause: err },
			);
		}
	}

	return {
		async has(key: string): Promise<boolean> {
			const res = await req("HEAD", key);
			return res.ok;
		},

		async get(key: string): Promise<Uint8Array | null> {
			const res = await req("GET", key);
			if (res.status === 404) return null;
			if (!res.ok) {
				throw new CacheError(
					`Remote cache GET returned HTTP ${res.status} for key "${key}"`,
				);
			}
			// Reject early when the server advertises an oversized body.
			const contentLength = res.headers?.get?.("content-length");
			const declared = Number(contentLength);
			if (Number.isFinite(declared) && declared > maxResponseBytes) {
				throw new CacheError(
					`Remote cache GET for key "${key}" exceeds ${maxResponseBytes} bytes (Content-Length ${declared})`,
				);
			}
			return await readBounded(res, key, maxResponseBytes);
		},

		async set(key: string, value: Uint8Array): Promise<void> {
			const res = await req("PUT", key, value);
			if (!res.ok) {
				throw new CacheError(
					`Remote cache PUT returned HTTP ${res.status} for key "${key}"`,
				);
			}
		},
	};
}

/**
 * Reads a response body into a single Uint8Array, aborting if the cumulative
 * size exceeds `limit`. Streams chunk-by-chunk so a server that omits or
 * understates Content-Length still cannot force an unbounded allocation.
 */
async function readBounded(
	res: Response,
	key: string,
	limit: number,
): Promise<Uint8Array> {
	// Loose null check intentionally covers both `null` (real fetch with no
	// body) and `undefined` (a Response-like object without a stream).
	if (res.body == null) {
		const buf = new Uint8Array(await res.arrayBuffer());
		if (buf.byteLength > limit) {
			throw new CacheError(
				`Remote cache GET for key "${key}" exceeds ${limit} bytes`,
			);
		}
		return buf;
	}

	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw new CacheError(
				`Remote cache GET for key "${key}" exceeds ${limit} bytes`,
			);
		}
		chunks.push(value);
	}

	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}
