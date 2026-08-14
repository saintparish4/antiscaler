import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeAdapter } from "../../types.js";
import { bunAdapter } from "../bun.js";
import { denoAdapter } from "../deno.js";
import { nodeAdapter } from "../node.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

const runCommand = vi.mocked(execSync);

function succeedsWith(output: string): void {
	runCommand.mockReturnValue(Buffer.from(output));
}

function fails(): void {
	runCommand.mockImplementation(() => {
		throw new Error("command not found");
	});
}

afterEach(() => {
	vi.resetAllMocks();
});

const adapters: Array<[string, RuntimeAdapter]> = [
	["node", nodeAdapter],
	["bun", bunAdapter],
	["deno", denoAdapter],
];

describe.each(adapters)("%s runtime adapter", (name, adapter) => {
	it("identifies itself by name", () => {
		expect(adapter.name).toBe(name);
	});

	it("is available when its version command succeeds", () => {
		succeedsWith("1.0.0");
		expect(adapter.available()).toBe(true);
		expect(runCommand).toHaveBeenCalledWith(
			`${name} --version`,
			expect.anything(),
		);
	});

	it("is unavailable when the binary is missing", () => {
		fails();
		expect(adapter.available()).toBe(false);
	});

	it("trims surrounding whitespace off the reported version", () => {
		succeedsWith("  1.2.3  \n");
		expect(adapter.version()).toBe("1.2.3");
	});

	it("reports a null version when the binary is missing", () => {
		fails();
		expect(adapter.version()).toBeNull();
	});
});

describe("deno runtime adapter", () => {
	// `deno --version` prints deno, v8, and typescript versions on separate
	// lines; only the first identifies the runtime.
	it("reports only the first line of a multi-line version banner", () => {
		succeedsWith("deno 1.40.0\nv8 12.1.0\ntypescript 5.3.3\n");
		expect(denoAdapter.version()).toBe("deno 1.40.0");
	});
});
