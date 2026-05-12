import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-ctx-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
});

function writeMinimalConfig(dir: string, config: object = {}): void {
	writeFileSync(
		path.join(dir, "antiscale.config.json"),
		JSON.stringify(config),
	);
}

describe("createContext", () => {
	it("returns a valid context with all defaults (no config file)", async () => {
		const dir = makeTmpDir();
		writeFileSync(path.join(dir, "package.json"), "{}");
		const { createContext } = await import("../context.js");
		const ctx = await createContext(dir);
		expect(ctx.cwd).toBe(dir);
		expect(ctx.config.strategy).toBe("adaptive");
		expect(ctx.pm).toBeDefined();
		expect(ctx.graph).toBeDefined();
		expect(ctx.plugins).toBeDefined();
	});

	it("loads JSON config file and applies it", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir, { strategy: "strict", tasks: { build: {} } });
		const { createContext } = await import("../context.js");
		const ctx = await createContext(dir);
		expect(ctx.config.strategy).toBe("strict");
	});

	it("workspace mode: auto-generates tasks from packages", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "pnpm-workspace.yaml"),
			"packages:\n  - 'packages/*'\n",
		);
		writeMinimalConfig(dir, {
			workspace: { enabled: true },
			tasks: {},
		});
		mkdirSync(path.join(dir, "packages/lib"), { recursive: true });
		writeFileSync(
			path.join(dir, "packages/lib/package.json"),
			JSON.stringify({ name: "lib", scripts: { build: "tsc" } }),
		);
		const { createContext } = await import("../context.js");
		const ctx = await createContext(dir);
		expect(ctx.config.tasks["lib:build"]).toBeDefined();
	});

	it("registers framework plugins in correct order", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir);
		const { createContext } = await import("../context.js");
		const ctx = await createContext(dir);
		const names = ctx.plugins.list().map((p) => p.name);
		expect(names).toContain("framework:next");
		expect(names).toContain("framework:vite");
		expect(names).toContain("framework:generic");
	});
});

describe("toRunOptions", () => {
	it("maps context fields to RunOptions", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir, { tasks: { build: {} } });
		const { createContext, toRunOptions } = await import("../context.js");
		const ctx = await createContext(dir);
		const opts = toRunOptions(ctx, { concurrency: 4 });
		expect(opts.cwd).toBe(dir);
		expect(opts.concurrency).toBe(4);
		expect(opts.pm).toBeDefined();
		expect(opts.config).toBe(ctx.config);
	});

	it("does not include useScheduler when scheduler policy is undefined", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir, { tasks: {} });
		const { createContext, toRunOptions } = await import("../context.js");
		const ctx = await createContext(dir);
		const opts = toRunOptions(ctx);
		expect(opts.useScheduler).toBeUndefined();
	});

	it("enables useScheduler when scheduler.policy is set", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir, {
			scheduler: { policy: "critical-path" },
			tasks: {},
		});
		const { createContext, toRunOptions } = await import("../context.js");
		const ctx = await createContext(dir);
		const opts = toRunOptions(ctx);
		expect(opts.useScheduler).toBe(true);
	});

	it("includes packageScopes when they exist on context", async () => {
		const dir = makeTmpDir();
		writeMinimalConfig(dir, { tasks: {} });
		const { createContext, toRunOptions } = await import("../context.js");
		const ctx = await createContext(dir);
		ctx.packageScopes = ["/some/dir"];
		const opts = toRunOptions(ctx);
		expect(opts.packageScopes).toEqual(["/some/dir"]);
	});
});
