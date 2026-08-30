import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// The probes memoize per module instance, so each test needs a fresh import
// to exercise a cold probe.
async function freshBun() {
	vi.resetModules();
	return (await import("../bun.js")).bunAdapter;
}
async function freshDeno() {
	vi.resetModules();
	return (await import("../deno.js")).denoAdapter;
}

beforeEach(() => {
	vi.resetAllMocks();
});
afterEach(() => {
	vi.resetAllMocks();
});

describe("node runtime adapter", () => {
	it("identifies itself by name", () => {
		expect(nodeAdapter.name).toBe("node");
	});

	// The running process already knows its own version; the adapter used to
	// spawn a second Node to ask.
	it("answers from the current process without spawning", () => {
		expect(nodeAdapter.version()).toBe(process.version);
		expect(nodeAdapter.available()).toBe(true);
		expect(runCommand).not.toHaveBeenCalled();
	});
});

describe.each([
	["bun", freshBun],
	["deno", freshDeno],
])("%s runtime adapter", (name, load) => {
	it("identifies itself by name", async () => {
		succeedsWith("1.0.0");
		expect((await load()).name).toBe(name);
	});

	it("is available when its version command succeeds", async () => {
		succeedsWith("1.0.0");
		const adapter = await load();

		expect(adapter.available()).toBe(true);
		expect(runCommand).toHaveBeenCalledWith(
			`${name} --version`,
			expect.anything(),
		);
	});

	it("is unavailable when the binary is missing", async () => {
		fails();
		expect((await load()).available()).toBe(false);
	});

	it("trims surrounding whitespace off the reported version", async () => {
		succeedsWith("  1.2.3  \n");
		expect((await load()).version()).toBe("1.2.3");
	});

	it("reports a null version when the binary is missing", async () => {
		fails();
		expect((await load()).version()).toBeNull();
	});

	it("probes once per process, however many questions are asked", async () => {
		succeedsWith("1.0.0");
		const adapter = await load();

		adapter.available();
		adapter.version();
		adapter.available();

		expect(runCommand).toHaveBeenCalledTimes(1);
	});

	// A missing binary is the expensive probe — a failed PATH search — so the
	// failure has to be cached too, not just the success.
	it("does not re-probe a binary it already failed to find", async () => {
		fails();
		const adapter = await load();

		adapter.available();
		adapter.version();

		expect(runCommand).toHaveBeenCalledTimes(1);
	});
});

describe("deno runtime adapter", () => {
	// `deno --version` prints deno, v8, and typescript versions on separate
	// lines; only the first identifies the runtime.
	it("reports only the first line of a multi-line version banner", async () => {
		succeedsWith("deno 1.40.0\nv8 12.1.0\ntypescript 5.3.3\n");
		expect((await freshDeno()).version()).toBe("deno 1.40.0");
	});
});
