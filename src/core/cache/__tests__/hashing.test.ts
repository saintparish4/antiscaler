import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashTaskInputs } from "../hashing.js";

// Track all temp dirs so afterEach can clean them up
const tmpDirs: string[] = [];

function makeTmpDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "antiscale-hash-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tmpDirs.length = 0;
});

describe("hashTaskInputs", () => {
	it("stable output: hashing the same directory twice produces the same hash", async () => {
		const dir = makeTmpDir();
		writeFileSync(join(dir, "a.ts"), "export const a = 1;");
		writeFileSync(join(dir, "b.ts"), "export const b = 2;");

		const hash1 = await hashTaskInputs(dir, ["*"]);
		const hash2 = await hashTaskInputs(dir, ["*"]);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // sha256 hex digest is always 64 chars
	});

	it("order-independent: file creation order does not affect hash (sort is working)", async () => {
		const dir1 = makeTmpDir();
		const dir2 = makeTmpDir();

		// dir1: write a.ts first, then b.ts
		writeFileSync(join(dir1, "a.ts"), "hello");
		writeFileSync(join(dir1, "b.ts"), "world");

		// dir2: write b.ts first, then a.ts (reversed)
		writeFileSync(join(dir2, "b.ts"), "world");
		writeFileSync(join(dir2, "a.ts"), "hello");

		const hash1 = await hashTaskInputs(dir1, ["*"]);
		const hash2 = await hashTaskInputs(dir2, ["*"]);

		expect(hash1).toBe(hash2);
	});

	it("content-sensitive: changing one file's content changes the hash", async () => {
		const dir = makeTmpDir();
		writeFileSync(join(dir, "a.ts"), "export const a = 1;");

		const hashBefore = await hashTaskInputs(dir, ["*"]);

		writeFileSync(join(dir, "a.ts"), "export const a = 99;"); // changed content

		const hashAfter = await hashTaskInputs(dir, ["*"]);

		expect(hashBefore).not.toBe(hashAfter);
	});

	it("file-set-sensitive: adding a file changes the hash", async () => {
		const dir = makeTmpDir();
		writeFileSync(join(dir, "a.ts"), "export const a = 1;");

		const hashBefore = await hashTaskInputs(dir, ["*"]);

		writeFileSync(join(dir, "b.ts"), "export const b = 2;"); // added file

		const hashAfter = await hashTaskInputs(dir, ["*"]);

		expect(hashBefore).not.toBe(hashAfter);
	});
});
