import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheError } from "../../errors.js";
import { createHttpCacheAdapter } from "../adapters/http-adapter.js";

const BASE = "https://cache.example.com";

function makeFetch(
	status: number,
	ok: boolean,
	body?: ArrayBuffer,
): typeof globalThis.fetch {
	return vi.fn().mockResolvedValue({
		ok,
		status,
		arrayBuffer: async () => body ?? new ArrayBuffer(0),
	} as unknown as Response);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HttpCacheAdapter.has()", () => {
	it("returns true when server responds 200", async () => {
		vi.stubGlobal("fetch", makeFetch(200, true));
		const adapter = createHttpCacheAdapter({ url: BASE });
		expect(await adapter.has("abc")).toBe(true);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			`${BASE}/abc`,
			expect.objectContaining({ method: "HEAD" }),
		);
	});

	it("returns false when server responds 404", async () => {
		vi.stubGlobal("fetch", makeFetch(404, false));
		const adapter = createHttpCacheAdapter({ url: BASE });
		expect(await adapter.has("abc")).toBe(false);
	});

	it("throws CacheError when fetch throws (network error)", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
		const adapter = createHttpCacheAdapter({ url: BASE });
		await expect(adapter.has("key")).rejects.toBeInstanceOf(CacheError);
	});

	it("strips trailing slash from base URL", async () => {
		const mockFetch = makeFetch(200, true);
		vi.stubGlobal("fetch", mockFetch);
		const adapter = createHttpCacheAdapter({ url: `${BASE}/` });
		await adapter.has("xyz");
		expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(`${BASE}/xyz`);
	});
});

describe("HttpCacheAdapter.get()", () => {
	it("returns bytes on 200", async () => {
		const payload = new Uint8Array([1, 2, 3]);
		vi.stubGlobal("fetch", makeFetch(200, true, payload.buffer as ArrayBuffer));
		const adapter = createHttpCacheAdapter({ url: BASE });
		const result = await adapter.get("key1");
		expect(result).toEqual(payload);
	});

	it("returns null on 404", async () => {
		vi.stubGlobal("fetch", makeFetch(404, false));
		const adapter = createHttpCacheAdapter({ url: BASE });
		expect(await adapter.get("key1")).toBeNull();
	});

	it("throws CacheError on non-404 server error", async () => {
		vi.stubGlobal("fetch", makeFetch(500, false));
		const adapter = createHttpCacheAdapter({ url: BASE });
		await expect(adapter.get("key1")).rejects.toBeInstanceOf(CacheError);
	});

	it("CacheError message includes status code", async () => {
		vi.stubGlobal("fetch", makeFetch(503, false));
		const adapter = createHttpCacheAdapter({ url: BASE });
		try {
			await adapter.get("k");
		} catch (err) {
			expect(String(err)).toContain("503");
		}
	});
});

describe("HttpCacheAdapter.set()", () => {
	it("calls PUT with correct body and Content-Type header", async () => {
		const mockFetch = makeFetch(200, true);
		vi.stubGlobal("fetch", mockFetch);
		const bytes = new Uint8Array([4, 5, 6]);
		const adapter = createHttpCacheAdapter({ url: BASE });
		await adapter.set("key2", bytes);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			`${BASE}/key2`,
			expect.objectContaining({
				method: "PUT",
				body: bytes,
				headers: expect.objectContaining({
					"Content-Type": "application/octet-stream",
				}),
			}),
		);
	});

	it("forwards custom headers alongside Content-Type", async () => {
		const mockFetch = makeFetch(200, true);
		vi.stubGlobal("fetch", mockFetch);
		const adapter = createHttpCacheAdapter({
			url: BASE,
			headers: { Authorization: "Bearer token123" },
		});
		await adapter.set("key3", new Uint8Array([7]));
		const callHeaders = (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit)
			?.headers as Record<string, string>;
		expect(callHeaders?.["Authorization"]).toBe("Bearer token123");
		expect(callHeaders?.["Content-Type"]).toBe("application/octet-stream");
	});

	it("throws CacheError on HTTP error response", async () => {
		vi.stubGlobal("fetch", makeFetch(503, false));
		const adapter = createHttpCacheAdapter({ url: BASE });
		await expect(
			adapter.set("key4", new Uint8Array([1])),
		).rejects.toBeInstanceOf(CacheError);
	});
});
