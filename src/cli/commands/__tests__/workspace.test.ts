import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	registerWorkspaceCheckAction,
	runWorkspaceCheck,
} from "../workspace.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-wscheck-"));
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
	process.exitCode = 0;
	vi.restoreAllMocks();
});

function writeFixture(dir: string, files: Record<string, string>): void {
	for (const [rel, content] of Object.entries(files)) {
		const abs = path.join(dir, rel);
		mkdirSync(path.dirname(abs), { recursive: true });
		writeFileSync(abs, content);
	}
}

/** Monorepo where @org/web imports @org/auth without declaring it. */
function violatingWorkspace(
	dir: string,
	webDeps: Record<string, string>,
): void {
	writeFixture(dir, {
		"package.json": JSON.stringify({
			name: "root",
			workspaces: ["packages/*", "apps/*"],
		}),
		"packages/auth/package.json": JSON.stringify({ name: "@org/auth" }),
		"packages/auth/src/index.ts": "export const login = (): number => 1;",
		"apps/web/package.json": JSON.stringify({
			name: "@org/web",
			dependencies: webDeps,
		}),
		"apps/web/src/page.ts":
			'import { login } from "@org/auth";\nexport const page = login();',
	});
}

describe("runWorkspaceCheck", () => {
	it("finds an undeclared workspace dependency", async () => {
		const dir = makeTmpDir();
		violatingWorkspace(dir, {});

		const result = await runWorkspaceCheck(dir);

		expect(result?.packagesChecked).toBe(2);
		expect(result?.violations).toEqual([
			{
				kind: "undeclared-workspace-dep",
				package: "@org/web",
				target: "@org/auth",
				files: ["apps/web/src/page.ts"],
			},
		]);
	});

	it("passes when the dependency is declared", async () => {
		const dir = makeTmpDir();
		violatingWorkspace(dir, { "@org/auth": "workspace:*" });

		const result = await runWorkspaceCheck(dir);
		expect(result?.violations).toEqual([]);
	});

	it("returns null without workspace packages", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			"package.json": JSON.stringify({ name: "solo" }),
			"src/a.ts": "export const a = 1;",
		});
		expect(await runWorkspaceCheck(dir)).toBeNull();
	});
});

describe("registerWorkspaceCheckAction", () => {
	function mockCwd(dir: string): void {
		vi.spyOn(process, "cwd").mockReturnValue(dir);
	}

	it("prints violations and sets exit code 1", async () => {
		const dir = makeTmpDir();
		violatingWorkspace(dir, {});
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerWorkspaceCheckAction();

		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("Checked 2 packages.");
		expect(out).toContain("@org/web imports @org/auth but does not declare it");
		expect(out).toContain("apps/web/src/page.ts");
		expect(out).toContain("1 violation found.");
		expect(process.exitCode).toBe(1);
	});

	it("prints a clean report with exit code 0 when declared", async () => {
		const dir = makeTmpDir();
		violatingWorkspace(dir, { "@org/auth": "workspace:*" });
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		process.exitCode = 0;

		await registerWorkspaceCheckAction();

		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("No dependency violations found.");
		expect(process.exitCode).toBe(0);
	});

	it("emits parseable JSON with --json and still gates CI", async () => {
		const dir = makeTmpDir();
		violatingWorkspace(dir, {});
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerWorkspaceCheckAction({ json: true });

		const parsed = JSON.parse(String(log.mock.calls[0]?.[0])) as {
			violations: { kind: string }[];
		};
		expect(parsed.violations[0]?.kind).toBe("undeclared-workspace-dep");
		expect(process.exitCode).toBe(1);
	});

	it("explains itself outside a workspace", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, { "package.json": JSON.stringify({ name: "solo" }) });
		mockCwd(dir);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await registerWorkspaceCheckAction();

		const out = log.mock.calls.map((c) => String(c[0])).join("\n");
		expect(out).toContain("no workspace packages found");
	});
});
