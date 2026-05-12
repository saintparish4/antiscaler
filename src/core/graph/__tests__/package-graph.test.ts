import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPackageGraph, tasksFromPackageGraph } from "../package-graph.js";

const tmpDirs: string[] = [];

const makeTmpDir = () => {
	const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-pg-"));
	tmpDirs.push(dir);
	return dir;
};

const fixture = () => {
	const root = makeTmpDir();
	writeFileSync(
		path.join(root, "pnpm-workspace.yaml"),
		"packages:\n  - 'packages/*'\n",
	);
	mkdirSync(path.join(root, "packages/utils"), { recursive: true });
	mkdirSync(path.join(root, "packages/web"), { recursive: true });
	writeFileSync(
		path.join(root, "packages/utils/package.json"),
		JSON.stringify({ name: "utils", scripts: { build: "tsc" } }),
	);
	writeFileSync(
		path.join(root, "packages/web/package.json"),
		JSON.stringify({
			name: "web",
			scripts: { build: "next build" },
			dependencies: { utils: "workspace:*" },
		}),
	);
	return root;
};

afterEach(() => {
	for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
	tmpDirs.length = 0;
});

describe("loadPackageGraph", () => {
	it("discovers pnpm workspace packages", async () => {
		const root = fixture();
		const g = await loadPackageGraph(root);
		expect(g.packages.map((p) => p.name).sort()).toEqual(["utils", "web"]);
	});

	it("computes intra-workspace edges only", async () => {
		const root = fixture();
		const g = await loadPackageGraph(root);
		expect([...(g.edges.get("web") ?? [])]).toEqual(["utils"]);
		expect([...(g.edges.get("utils") ?? [])]).toEqual([]);
	});

	it("readWorkspaceGlobs: falls back to package.json workspaces array", async () => {
		const root = makeTmpDir();
		writeFileSync(
			path.join(root, "package.json"),
			JSON.stringify({ workspaces: ["packages/*"] }),
		);
		mkdirSync(path.join(root, "packages/lib"), { recursive: true });
		writeFileSync(
			path.join(root, "packages/lib/package.json"),
			JSON.stringify({ name: "lib", scripts: { build: "tsc" } }),
		);
		const g = await loadPackageGraph(root);
		expect(g.packages.map((p) => p.name)).toContain("lib");
	});

	it("readWorkspaceGlobs: uses fallback when no config present", async () => {
		const root = makeTmpDir();
		writeFileSync(path.join(root, "package.json"), JSON.stringify({}));
		mkdirSync(path.join(root, "packages/x"), { recursive: true });
		writeFileSync(
			path.join(root, "packages/x/package.json"),
			JSON.stringify({ name: "x" }),
		);
		const g = await loadPackageGraph(root);
		expect(g.packages.map((p) => p.name)).toContain("x");
	});

	it("skips directories without package.json", async () => {
		const root = makeTmpDir();
		writeFileSync(
			path.join(root, "pnpm-workspace.yaml"),
			"packages:\n  - 'packages/*'\n",
		);
		mkdirSync(path.join(root, "packages/no-manifest"), { recursive: true });
		const g = await loadPackageGraph(root);
		expect(g.packages).toHaveLength(0);
	});

	it("skips packages with no name field in manifest", async () => {
		const root = makeTmpDir();
		writeFileSync(
			path.join(root, "pnpm-workspace.yaml"),
			"packages:\n  - 'packages/*'\n",
		);
		mkdirSync(path.join(root, "packages/anon"), { recursive: true });
		writeFileSync(
			path.join(root, "packages/anon/package.json"),
			JSON.stringify({ version: "1.0.0" }),
		);
		const g = await loadPackageGraph(root);
		expect(g.packages).toHaveLength(0);
	});
});

describe("tasksFromPackageGraph", () => {
	it("auto-generates <pkg>:build tasks with cross-pkg deps", async () => {
		const root = fixture();
		const g = await loadPackageGraph(root);
		const tasks = tasksFromPackageGraph(g, {});
		expect(tasks["web:build"]).toBeDefined();
		expect(tasks["web:build"]?.dependsOn).toEqual(["utils:build"]);
	});

	it("user-defined tasks win over generated ones", async () => {
		const root = fixture();
		const g = await loadPackageGraph(root);
		const existing = { "web:build": { command: "echo override" } };
		const tasks = tasksFromPackageGraph(g, existing);
		expect(tasks["web:build"]?.command).toBe("echo override");
	});

	it("custom scripts filter", async () => {
		const root = fixture();
		const g = await loadPackageGraph(root);
		const tasks = tasksFromPackageGraph(g, {}, ["test"]);
		expect(tasks["web:build"]).toBeUndefined();
		expect(tasks["utils:build"]).toBeUndefined();
	});
});
