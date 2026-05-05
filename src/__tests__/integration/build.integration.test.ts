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
		const { stdout } = await execa("node", [cli, "build"], { cwd });
		expect(stdout).toMatch(/utils:build/);
		expect(stdout).toMatch(/web:build/);
	});

	it("second run: cache hits", async () => {
		const { stdout } = await execa("node", [cli, "build"], { cwd });
		expect(stdout).toMatch(/cache hit/i);
	});

	it("incremental: changing one file rebuilds only affected", async () => {
		const f = path.join(cwd, "packages/utils/src/index.ts");
		const fs = await import("node:fs/promises");
		const orig = await fs.readFile(f, "utf8");
		await fs.writeFile(f, `${orig}\nexport const x = 1;`);
		const { stdout } = await execa("node", [cli, "build"], { cwd });
		expect(stdout).toMatch(/utils:build/);
		expect(stdout).not.toMatch(/api:build:.*cache hit/);
	});
});
