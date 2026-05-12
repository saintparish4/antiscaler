import { describe, expect, it } from "vitest";
import { detectRuntime, toRuntimeInfo } from "../runtime.js";

describe("detectRuntime", () => {
	it("returns node adapter when running under node (default env)", () => {
		const adapter = detectRuntime();
		expect(adapter.name).toBe("node");
	});

	it("adapter has available() and version() methods", () => {
		const adapter = detectRuntime();
		expect(typeof adapter.available).toBe("function");
		expect(typeof adapter.version).toBe("function");
	});
});

describe("toRuntimeInfo", () => {
	it("sets primary to adapter name", () => {
		const info = toRuntimeInfo({
			name: "bun",
			available: () => true,
			version: () => "1.0",
		});
		expect(info.primary).toBe("bun");
	});

	it("fallback is always 'node'", () => {
		const info = toRuntimeInfo({
			name: "deno",
			available: () => true,
			version: () => "1.0",
		});
		expect(info.fallback).toBe("node");
	});

	it("fallback is 'node' even when primary is node", () => {
		const info = toRuntimeInfo({
			name: "node",
			available: () => true,
			version: () => "20.0",
		});
		expect(info.fallback).toBe("node");
	});
});
