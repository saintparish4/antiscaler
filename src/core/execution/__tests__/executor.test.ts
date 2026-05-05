import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskExecutionError } from "../../errors.js";
import { executeTask } from "../executor.js";

// We mock `execa` at module level so we can swap implementations per-test.
// `ExecaError` must also be exported from the mock since executor.ts uses
// `instanceof ExecaError` to detect typed failures.
class MockExecaError extends Error {
	exitCode?: number;
	signal?: string;
	constructor(opts: { exitCode?: number; signal?: string; message?: string }) {
		super(opts.message ?? "execa failed");
		if (opts.exitCode !== undefined) this.exitCode = opts.exitCode;
		if (opts.signal !== undefined) this.signal = opts.signal;
	}
}

vi.mock("execa", () => ({
	execa: vi.fn(),
	ExecaError: MockExecaError,
}));

async function getMockedExeca() {
	const { execa } = await import("execa");
	return execa as unknown as ReturnType<typeof vi.fn>;
}

describe("executeTask -- success paths", () => {
	beforeEach(async () => {
		const execa = await getMockedExeca();
		execa.mockReset();
		execa.mockResolvedValue({ exitCode: 0 });
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("preserves quoted args as a single argv element", async () => {
		const execa = await getMockedExeca();
		await executeTask(
			"echo-quoted",
			{ command: `node -e "console.log('x y')"` },
			"npm",
			process.cwd(),
		);
		expect(execa).toHaveBeenCalledWith(
			"node",
			["-e", "console.log('x y')"],
			expect.objectContaining({ stdio: "inherit" }),
		);
	});

	it("falls back to `<pm> run <name>` when no command is provided", async () => {
		const execa = await getMockedExeca();
		await executeTask("build", {}, "pnpm", process.cwd());
		expect(execa).toHaveBeenCalledWith(
			"pnpm",
			["run", "build"],
			expect.objectContaining({ stdio: "inherit" }),
		);
	});

	it("collapses runs of whitespace cleanly", async () => {
		const execa = await getMockedExeca();
		await executeTask(
			"spaced",
			{ command: "node    --version" },
			"npm",
			process.cwd(),
		);
		expect(execa).toHaveBeenCalledWith(
			"node",
			["--version"],
			expect.objectContaining({ stdio: "inherit" }),
		);
	});
});

describe("executeTask -- error paths", () => {
	beforeEach(async () => {
		const execa = await getMockedExeca();
		execa.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("throws TaskExecutionError on empty command", async () => {
		await expect(
			executeTask("empty", { command: "   " }, "npm", process.cwd()),
		).rejects.toBeInstanceOf(TaskExecutionError);
	});

	it("preserves exit code and original cause from ExecaError", async () => {
		const execa = await getMockedExeca();
		const inner = new MockExecaError({ exitCode: 17, message: "tsc failed" });
		execa.mockRejectedValueOnce(inner);

		try {
			await executeTask("typecheck", { command: "tsc" }, "npm", process.cwd());
			throw new Error("expected throw");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(TaskExecutionError);
			const tee = err as TaskExecutionError;
			expect(tee.exitCode).toBe(17);
			expect(tee.cause).toBe(inner);
		}
	});

	it("surfaces signal kills (SIGKILL / OOM)", async () => {
		const execa = await getMockedExeca();
		const inner = new MockExecaError({ signal: "SIGKILL" });
		execa.mockRejectedValueOnce(inner);

		try {
			await executeTask(
				"build",
				{ command: "next build" },
				"npm",
				process.cwd(),
			);
			throw new Error("expected throw");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(TaskExecutionError);
			expect((err as TaskExecutionError).message).toMatch(/SIGKILL/);
		}
	});

	it("falls back to exit code 1 for non-execa errors and preserves cause", async () => {
		const execa = await getMockedExeca();
		const inner = new Error("ENOENT spawn failure");
		execa.mockRejectedValueOnce(inner);

		try {
			await executeTask(
				"missing",
				{ command: "doesnotexist" },
				"npm",
				process.cwd(),
			);
			throw new Error("expected throw");
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(TaskExecutionError);
			const tee = err as TaskExecutionError;
			expect(tee.exitCode).toBe(1);
			expect(tee.cause).toBe(inner);
		}
	});
});
