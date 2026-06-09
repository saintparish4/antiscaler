import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiscaleError } from "../../../core/errors.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-build-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs) {
		try {
			rmSync(d, { recursive: true, force: true });
		} catch {
			// Windows holds directory handles briefly after child processes exit;
			// the OS cleans these up eventually.
		}
	}
	tmpDirs.length = 0;
	vi.restoreAllMocks();
});

describe("registerBuildAction", () => {
	it("runs the build task and prints insight output", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: {
					build: { command: "echo build-ok" },
				},
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			await registerBuildAction();
			const out = log.mock.calls.map((c) => String(c[0])).join("\n");
			expect(out).toContain("build");
		} finally {
			process.cwd = origCwd;
		}
	});

	it("rejects with AntiscaleError when no 'build' task is defined in config", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { lint: { command: "echo lint-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			await expect(registerBuildAction()).rejects.toBeInstanceOf(
				AntiscaleError,
			);
		} finally {
			process.cwd = origCwd;
		}
	});

	it("runs build with scope option when a trace session file exists", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: { command: "echo build-scope-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		// Create a trace session file so loadTrace succeeds
		const traceDir = path.join(dir, ".antiscale", "traces");
		mkdirSync(traceDir, { recursive: true });
		writeFileSync(
			path.join(traceDir, "scope-sess.json"),
			JSON.stringify({
				schemaVersion: 1,
				sessionId: "scope-sess",
				startedAt: Date.now(),
				endedAt: Date.now() + 100,
				framework: "next",
				modules: [],
				routes: [],
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			await expect(
				registerBuildAction({ scope: "scope-sess" }),
			).resolves.toBeUndefined();
		} finally {
			process.cwd = origCwd;
		}
	});

	it("affected: true with no git is a no-op (runs all tasks)", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: { command: "echo build-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			// No git → affectedPackages undefined → --affected is a no-op
			await expect(
				registerBuildAction({ affected: true }),
			).resolves.toBeUndefined();
		} finally {
			process.cwd = origCwd;
		}
	});

	it("affected: true filters tasks to affected packages only", async () => {
		const dir = makeTmpDir();
		// workspace: utils (changed), web (depends on utils), docs (no dep)
		writeFileSync(
			path.join(dir, "pnpm-workspace.yaml"),
			"packages:\n  - 'packages/*'\n",
		);
		for (const name of ["utils", "web", "docs"]) {
			mkdirSync(path.join(dir, `packages/${name}/src`), { recursive: true });
		}
		writeFileSync(
			path.join(dir, "packages/utils/package.json"),
			JSON.stringify({ name: "utils", scripts: { build: "echo utils:build" } }),
		);
		writeFileSync(
			path.join(dir, "packages/utils/src/index.ts"),
			"export const x = 1;\n",
		);
		writeFileSync(
			path.join(dir, "packages/web/package.json"),
			JSON.stringify({
				name: "web",
				scripts: { build: "echo web:build" },
				dependencies: { utils: "workspace:*" },
			}),
		);
		writeFileSync(
			path.join(dir, "packages/web/src/index.ts"),
			"export const y = 1;\n",
		);
		writeFileSync(
			path.join(dir, "packages/docs/package.json"),
			JSON.stringify({ name: "docs", scripts: { build: "echo docs:build" } }),
		);
		writeFileSync(
			path.join(dir, "packages/docs/src/index.ts"),
			"export const z = 1;\n",
		);
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				workspace: { enabled: true },
				tasks: { build: { command: "node -e 0" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);

		const GIT = "-c user.email=t@t.com -c user.name=T";
		const run = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "ignore" });
		run("git init");
		run(`git ${GIT} commit --allow-empty -m base`);
		run("git add .");
		run(`git ${GIT} commit -m initial`);
		// Change only utils; web is a cascade dep, docs is not
		writeFileSync(
			path.join(dir, "packages/utils/src/index.ts"),
			"export const x = 2;\n",
		);
		run("git add .");
		run(`git ${GIT} commit -m "change utils"`);

		const rows: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args) => {
			rows.push(String(args[0]));
		});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			await registerBuildAction({ affected: true });
		} finally {
			process.cwd = origCwd;
		}

		const out = rows.join("\n");
		const statusLine = (name: string) =>
			out.split("\n").find((l) => l.includes(name) && /MISS|HIT|SKIP/.test(l));

		// utils changed → must run
		expect(statusLine("utils:build")).toMatch(/MISS|HIT/);
		// web depends on utils → cascade → must run
		expect(statusLine("web:build")).toMatch(/MISS|HIT/);
		// docs has no dependency on utils → must be skipped
		expect(statusLine("docs:build")).toMatch(/SKIP/);
	});

	it("respects concurrency option without throwing", async () => {
		const dir = makeTmpDir();
		writeFileSync(
			path.join(dir, "antiscale.config.json"),
			JSON.stringify({
				tasks: { build: { command: "echo build-ok" } },
				cache: { directory: path.join(dir, ".antiscale/cache") },
			}),
		);
		vi.spyOn(console, "log").mockImplementation(() => {});
		const origCwd = process.cwd;
		process.cwd = () => dir;
		try {
			const { registerBuildAction } = await import("../build.js");
			await expect(
				registerBuildAction({ concurrency: 1 }),
			).resolves.toBeUndefined();
		} finally {
			process.cwd = origCwd;
		}
	});
});
