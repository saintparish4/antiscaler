import { describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "../registry.js";
import type { BuildPlugin } from "../types.js";

const noop = (): BuildPlugin => ({ name: "noop", hooks: {} });

describe("PluginRegistry", () => {
	it("invokes onDetect in registration order", async () => {
		const calls: string[] = [];
		const reg = new PluginRegistry(() => {});
		reg.register({
			name: "a",
			hooks: {
				onDetect: () => {
					calls.push("a");
				},
			},
		});
		reg.register({
			name: "b",
			hooks: {
				onDetect: () => {
					calls.push("b");
				},
			},
		});
		await reg.runOnDetect({ cwd: "/", pm: "pnpm", framework: null, tasks: {} });
		expect(calls).toEqual(["a", "b"]);
	});

	it("composes onHash outputs into a sorted deduped array", async () => {
		const reg = new PluginRegistry(() => {});
		reg.register({ name: "a", hooks: { onHash: () => ["b", "a"] } });
		reg.register({ name: "b", hooks: { onHash: () => ["a", "c"] } });
		expect(await reg.runOnHash("t", [])).toEqual(["a", "b", "c"]);
	});

	it("onBeforeExecute returning false short-circuits", async () => {
		const reg = new PluginRegistry(() => {});
		reg.register({ name: "a", hooks: { onBeforeExecute: () => false } });
		reg.register({ name: "b", hooks: { onBeforeExecute: () => true } });
		expect(await reg.runOnBeforeExecute("t")).toBe(true);
	});

	it("isolates plugin errors via onError hook", async () => {
		const onError = vi.fn();
		const reg = new PluginRegistry(onError);
		reg.register({
			name: "bad",
			hooks: {
				onDetect: () => {
					throw new Error("boom");
				},
			},
		});
		reg.register(noop());
		await reg.runOnDetect({ cwd: "/", pm: "pnpm", framework: null, tasks: {} });
		expect(onError).toHaveBeenCalledWith(expect.any(Error), "bad", "onDetect");
	});
});
