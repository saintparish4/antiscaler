import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures/basic-monorepo");
const cli = path.resolve(here, "../../../dist/cli.js");

describe("E2E: basic-monorepo", () => {
	let cwd: string;
	beforeAll(() => {
		cwd = mkdtempSync(path.join(tmpdir(), "antiscaler-e2e-"));
		cpSync(fixture, cwd, { recursive: true });
	});
	afterAll(() => rmSync(cwd, { recursive: true, force: true }));

	it("fresh build: runs all tasks in dependency order", async () => {
		const result = await execa("node", [cli, "build"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/utils:build/);
		expect(result.stdout).toMatch(/web:build/);
	});

	it("second run: cache hits", async () => {
		const result = await execa("node", [cli, "build"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/HIT/i);
	});

	it("incremental: changing one file rebuilds only affected", async () => {
		const f = path.join(cwd, "packages/utils/src/index.ts");
		const fs = await import("node:fs/promises");
		const orig = await fs.readFile(f, "utf8");
		await fs.writeFile(f, `${orig}\nexport const x = 1;`);
		const result = await execa("node", [cli, "build"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/utils/);
	});

	it("check command: validates config successfully", async () => {
		const result = await execa("node", [cli, "check"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/valid/i);
	});

	it("env command: prints detected environment", async () => {
		const result = await execa("node", [cli, "env"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/Package Manager/);
		expect(result.stdout).toMatch(/Runtime/);
	});

	it("init command: refuses when config exists", async () => {
		const result = await execa("node", [cli, "init"], { cwd });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/already exists/);
	});

	it("build with invalid --concurrency: exits non-zero", async () => {
		const result = await execa("node", [cli, "build", "-c", "abc"], {
			cwd,
			reject: false,
		});
		expect(result.exitCode).not.toBe(0);
	});
});
