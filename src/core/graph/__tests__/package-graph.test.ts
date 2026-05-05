import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackageGraph, tasksFromPackageGraph } from "../package-graph.js";

const fixture = () => {
	const root = mkdtempSync(path.join(tmpdir(), "antiscaler-pg-"));
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
});
