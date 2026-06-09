import { CacheError } from "../../errors.js";
import type { RemoteCacheAdapter } from "../remote-adapter.js";

export interface HttpCacheAdapterOptions {
	/** Base URL of the cache endpoint. Keys are appended as path segments. */
	url: string;
	/** Extra HTTP headers (e.g. Authorization tokens). */
	headers?: Record<string, string>;
	/** Request timeout in milliseconds. Default: 10 000. */
	timeout?: number;
}

export function createHttpCacheAdapter(
	options: HttpCacheAdapterOptions,
): RemoteCacheAdapter {
	const { url, headers = {}, timeout = 10_000 } = options;
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
				body,
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
			return new Uint8Array(await res.arrayBuffer());
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
