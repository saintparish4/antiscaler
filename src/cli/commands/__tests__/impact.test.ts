import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	defaultHistoryDir,
	readImpactPredictions,
} from "../../../core/history/impact-log.js";
import { registerImpactAction, runImpact } from "../impact.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-impact-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds directory handles briefly; the OS cleans these up eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

function writeFixture(dir: string, files: Record<string, string>): void {
	for (const [rel, content] of Object.entries(files)) {
		const abs = path.join(dir, rel);
		mkdirSync(path.dirname(abs), { recursive: true });
		writeFileSync(abs, content);
	}
}

const AUTH_BEFORE =
	"export function login(name: string): string { return name; }";
const FIXTURE = {
	"src/app.ts":
		'import { login } from "./auth.js";\nexport const boot = (): string => login("a");',
	"src/app.test.ts":
		'import { boot } from "./app.js";\nexport const t = boot();',
	"src/unrelated.test.ts": "export const u = 1;",
};

describe("runImpact", () => {
	it("reports build-required for a signature change and logs the prediction", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			...FIXTURE,
			"src/auth.ts":
				"export function login(name: string, strict: boolean): string { return name; }",
		});

		const report = await runImpact(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		expect(report?.verdict).toBe("build-required");
		expect(report?.result.tests.affectedTests).toEqual(["src/app.test.ts"]);
		expect(report?.result.tests.totalTests).toBe(2);
		expect(report?.historyLogged).toBe(true);

		const records = await readImpactPredictions(defaultHistoryDir(dir));
		expect(records).toHaveLength(1);
		expect(records[0]?.verdict).toBe("build-required");
		expect(records[0]?.affectedTests).toEqual(["src/app.test.ts"]);
		expect(records[0]?.changedFiles).toEqual(["src/auth.ts"]);
	});

	it("reports safe-to-skip with zero tests for a comment-only change", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			...FIXTURE,
			"src/auth.ts": `${AUTH_BEFORE}\n// clarifying comment`,
		});

		const report = await runImpact(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		expect(report?.verdict).toBe("safe-to-skip");
		expect(report?.result.tests.affectedTests).toEqual([]);
	});

	it("reports build-recommended for a body-only change", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			...FIXTURE,
			"src/auth.ts":
				"export function login(name: string): string { return name.trim(); }",
		});

		const report = await runImpact(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		expect(report?.verdict).toBe("build-recommended");
		expect(report?.result.tests.affectedTests).toEqual(["src/app.test.ts"]);
	});

	it("config changes force build-required via select-all", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, { ...FIXTURE, "src/auth.ts": AUTH_BEFORE });

		const report = await runImpact(dir, {
			changedFiles: ["package.json"],
			readBefore: async () => null,
		});

		expect(report?.verdict).toBe("build-required");
		expect(report?.result.tests.selectAll).toBe(true);
		expect(report?.result.tests.affectedTests).toHaveLength(2);
	});

	it("returns null when git is unavailable and no changed files are given", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, { "src/a.ts": "export const a = 1;" });
		expect(await runImpact(dir)).toBeNull();
	});
});

describe("registerImpactAction", () => {
	function mockCwd(dir: string): void {
		vi.spyOn(process, "cwd").mockReturnValue(dir);
	}

	it("prints the run/skip block with the report-only disclaimer", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			...FIXTURE,
			"src/auth.ts":
				"export function login(name: string, strict: boolean): string { return name; }",
		});
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerImpactAction({
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("You changed 1 file.");
		expect(out).toContain("breaking");
		expect(out).toContain("Run:   1 test files");
		expect(out).toContain("Skip:  1 test files (of 2 total)");
		expect(out).toContain("Verdict:    build required");
		expect(out).toContain("report-only");
	});

	it("emits parseable JSON with --json", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			...FIXTURE,
			"src/auth.ts": `${AUTH_BEFORE}\n// comment`,
		});
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerImpactAction({
			json: true,
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		const parsed = JSON.parse(String(log.mock.calls[0]?.[0])) as {
			verdict: string;
			tests: { affectedTests: string[] };
		};
		expect(parsed.verdict).toBe("safe-to-skip");
		expect(parsed.tests.affectedTests).toEqual([]);
	});

	it("degrades gracefully outside a usable git context", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, { "src/a.ts": "export const a = 1;" });
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerImpactAction();

		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("could not determine changed files");
	});
});
