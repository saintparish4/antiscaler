import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildImportGraph } from "../../graph/import-graph.js";
import type { FileImpact } from "../blast-radius.js";
import {
	assembleBlastRadius,
	toFileImpact,
	traceBlastRadius,
} from "../blast-radius.js";
import type { ImportEntry, SymbolGraph } from "../symbol-graph.js";

function makeSymbolGraph(files: Record<string, ImportEntry[]>): SymbolGraph {
	const out: SymbolGraph["files"] = {};
	for (const [file, imports] of Object.entries(files)) {
		out[file] = { contentHash: "", symbols: [], imports, notes: [] };
	}
	return { version: 1, generatedAt: "", files: out };
}

function namedImport(module: string, names: string[]): ImportEntry {
	return { module, kind: "static", typeOnly: false, names };
}

function breaking(filePath: string, impactedSymbols: string[]): FileImpact {
	return {
		filePath,
		classification: "breaking",
		impactedSymbols,
		propagates: true,
		notes: [],
	};
}

/**
 * auth.ts is imported four ways; uses-login/uses-version each have one
 * further dependent so second-hop behavior is observable.
 */
const GATING_GRAPH = buildImportGraph(
	makeSymbolGraph({
		"src/auth.ts": [],
		"src/uses-login.ts": [namedImport("./auth.js", ["login"])],
		"src/uses-version.ts": [namedImport("./auth.js", ["VERSION"])],
		"src/star.ts": [namedImport("./auth.js", ["*"])],
		"src/dynamic.ts": [
			{ module: "./auth.js", kind: "dynamic", typeOnly: false, names: [] },
		],
		"src/downstream.ts": [namedImport("./uses-login.js", ["boot"])],
		"src/gated-child.ts": [namedImport("./uses-version.js", ["v"])],
	}),
);

describe("assembleBlastRadius", () => {
	it("non-impacting changes are not seeds", () => {
		const radius = assembleBlastRadius(
			"HEAD~1",
			[
				{
					filePath: "src/auth.ts",
					classification: "non-impacting",
					impactedSymbols: [],
					propagates: false,
					notes: [],
				},
			],
			GATING_GRAPH,
		);
		expect(radius.affectedFiles).toEqual([]);
		expect(radius.affectedPackages).toEqual([]);
		expect(radius.confidence).toBe(1);
	});

	it("internal (body-only) changes affect the file but do not propagate", () => {
		const radius = assembleBlastRadius(
			"HEAD~1",
			[
				{
					filePath: "src/auth.ts",
					classification: "internal",
					impactedSymbols: [],
					propagates: false,
					notes: [],
				},
			],
			GATING_GRAPH,
		);
		expect(radius.affectedFiles).toEqual(["src/auth.ts"]);
	});

	it("gates the first hop per symbol and walks structurally after it", () => {
		const radius = assembleBlastRadius(
			"HEAD~1",
			[breaking("src/auth.ts", ["login"])],
			GATING_GRAPH,
		);

		// uses-login imports the changed symbol; star imports everything;
		// dynamic is unknowable; downstream follows uses-login structurally.
		expect(radius.affectedFiles).toEqual([
			"src/auth.ts",
			"src/downstream.ts",
			"src/dynamic.ts",
			"src/star.ts",
			"src/uses-login.ts",
		]);
		// uses-version imports only an untouched symbol — gated out, and its
		// own dependent is never visited.
		expect(radius.affectedFiles).not.toContain("src/uses-version.ts");
		expect(radius.affectedFiles).not.toContain("src/gated-child.ts");
		expect(
			radius.notes.some((n) => n.includes("dynamic import of src/auth.ts")),
		).toBe(true);
		expect(radius.confidence).toBeLessThan(1);
	});

	it("pure export additions reach only wildcard importers", () => {
		const radius = assembleBlastRadius(
			"HEAD~1",
			[breaking("src/auth.ts", [])],
			GATING_GRAPH,
		);
		expect(radius.affectedFiles).toContain("src/star.ts");
		expect(radius.affectedFiles).toContain("src/dynamic.ts");
		expect(radius.affectedFiles).not.toContain("src/uses-login.ts");
		expect(radius.affectedFiles).not.toContain("src/uses-version.ts");
	});

	it("unanalyzed files are seeds that never propagate", () => {
		const graph = buildImportGraph(
			makeSymbolGraph({
				"src/a.ts": [],
				"src/b.ts": [namedImport("./a.js", ["x"])],
			}),
		);
		const radius = assembleBlastRadius(
			"HEAD~1",
			[
				{
					filePath: "package.json",
					classification: "unanalyzed",
					impactedSymbols: [],
					propagates: false,
					notes: ["package.json: not a TypeScript source; change not analyzed"],
				},
			],
			graph,
		);
		expect(radius.affectedFiles).toEqual(["package.json"]);
		expect(radius.notes).toHaveLength(1);
		expect(radius.confidence).toBeLessThan(1);
	});

	it("notes unresolved imports on affected files", () => {
		const graph = buildImportGraph(
			makeSymbolGraph({
				"src/a.ts": [namedImport("./missing.js", ["gone"])],
			}),
		);
		const radius = assembleBlastRadius(
			"HEAD~1",
			[breaking("src/a.ts", ["x"])],
			graph,
		);
		expect(
			radius.notes.some((n) =>
				n.includes("src/a.ts: unresolved imports (./missing.js)"),
			),
		).toBe(true);
	});

	it("maps affected files to packages and tasks", () => {
		const graph = buildImportGraph(
			makeSymbolGraph({
				"packages/auth/src/index.ts": [],
				"apps/web/src/page.ts": [namedImport("@org/auth", ["login"])],
			}),
			{ packageDirs: { "@org/auth": "packages/auth", "@org/web": "apps/web" } },
		);
		const radius = assembleBlastRadius(
			"HEAD~1",
			[breaking("packages/auth/src/index.ts", ["login"])],
			graph,
			{
				packageDirs: { "@org/auth": "packages/auth", "@org/web": "apps/web" },
				tasks: {
					"@org/auth:build": { command: "b" },
					"@org/web:build": { command: "b" },
					"@org/web:test": { command: "t" },
					"@org/db:build": { command: "b" },
					build: { command: "b" },
				},
			},
		);

		expect(radius.affectedPackages).toEqual(["@org/auth", "@org/web"]);
		expect(radius.affectedTasks).toEqual([
			"@org/auth:build",
			"@org/web:build",
			"@org/web:test",
		]);
	});

	it("clamps confidence at the floor", () => {
		const impacts: FileImpact[] = Array.from({ length: 10 }, (_, i) => ({
			filePath: `src/f${i}.ts`,
			classification: "unanalyzed" as const,
			impactedSymbols: [],
			propagates: false,
			notes: [`src/f${i}.ts: note`],
		}));
		const radius = assembleBlastRadius(
			"HEAD~1",
			impacts,
			buildImportGraph(makeSymbolGraph({})),
		);
		expect(radius.confidence).toBe(0.3);
	});
});

describe("toFileImpact", () => {
	it("collects removed and shape-changed symbols, excluding body edits", () => {
		const impact = toFileImpact({
			filePath: "src/a.ts",
			classification: "breaking",
			exportedSymbols: {
				added: ["fresh"],
				removed: ["gone"],
				changed: [
					{ name: "resized", kind: "signature" },
					{ name: "retyped", kind: "type" },
					{ name: "tweaked", kind: "body" },
				],
			},
			confidence: 0.85,
			confidenceNotes: ['export * from "./x" hides which names are exported'],
		});

		expect(impact.impactedSymbols).toEqual(["gone", "resized", "retyped"]);
		expect(impact.propagates).toBe(true);
		expect(impact.notes).toEqual([
			'src/a.ts: export * from "./x" hides which names are exported',
		]);
	});

	it("internal results do not propagate", () => {
		const impact = toFileImpact({
			filePath: "src/a.ts",
			classification: "internal",
			exportedSymbols: {
				added: [],
				removed: [],
				changed: [{ name: "f", kind: "body" }],
			},
			confidence: 1,
			confidenceNotes: [],
		});
		expect(impact.propagates).toBe(false);
		expect(impact.impactedSymbols).toEqual([]);
	});
});

describe("traceBlastRadius", () => {
	const tmpDirs: string[] = [];
	function makeTmpDir(): string {
		const dir = mkdtempSync(path.join(tmpdir(), "antiscaler-blast-"));
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

	it("runs the full pipeline: differ gating plus graph traversal", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			// Signature change vs AUTH_BEFORE: extra parameter.
			"src/auth.ts":
				"export function login(name: string, strict: boolean): string { return name; }",
			"src/app.ts":
				'import { login } from "./auth.js";\nexport const boot = (): string => login("a", true);',
			"src/other.ts": "export const other = 1;",
		});

		const radius = await traceBlastRadius(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		expect(radius).not.toBeNull();
		expect(radius?.changed[0]?.classification).toBe("breaking");
		expect(radius?.affectedFiles).toEqual(["src/app.ts", "src/auth.ts"]);
	});

	it("does not propagate a body-only edit", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, {
			// Body change vs AUTH_BEFORE: same signature, different return expr.
			"src/auth.ts":
				"export function login(name: string): string { return name.trim(); }",
			"src/app.ts":
				'import { login } from "./auth.js";\nexport const boot = (): string => login("a");',
		});

		const radius = await traceBlastRadius(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore: async () => AUTH_BEFORE,
		});

		expect(radius?.changed[0]?.classification).toBe("internal");
		expect(radius?.affectedFiles).toEqual(["src/auth.ts"]);
	});

	it("returns null when git is unavailable and no changed files are given", async () => {
		const dir = makeTmpDir();
		writeFixture(dir, { "src/a.ts": "export const a = 1;" });
		// A fresh tmp dir is not a git repository, so getChangedFiles fails.
		const radius = await traceBlastRadius(dir, { baseRef: "HEAD~1" });
		expect(radius).toBeNull();
	});
});
