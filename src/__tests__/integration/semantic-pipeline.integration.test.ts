/**
 * Boundary: the change-intelligence pipeline entry points against a real
 * source tree — `loadImportGraph`, `traceBlastRadius`, `traceTestImpact`. Each
 * parses files off disk with ts-morph and persists a symbol-graph index, so
 * none of them can say anything true without a fixture workspace.
 *
 * The pure halves of these modules — `buildImportGraph`, `assembleBlastRadius`,
 * `computeTestImpact`, which take an injected SymbolGraph — stay unit tests
 * beside their sources.
 */

import { afterEach, describe, expect, it } from "vitest";
import { loadImportGraph } from "../../core/graph/import-graph.js";
import { traceBlastRadius } from "../../core/semantic/blast-radius.js";
import {
	defaultGraphDir,
	loadSymbolGraph,
} from "../../core/semantic/symbol-graph.js";
import { traceTestImpact } from "../../core/semantic/test-impact.js";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeFiles,
} from "../helpers/cli-harness.js";

const AUTH_BEFORE =
	"export function login(name: string): string { return name; }";

const readBefore = async (): Promise<string> => AUTH_BEFORE;

/** `app.ts` imports `auth.ts`; one test covers app, one covers nothing. */
const APP_FIXTURE = {
	"src/app.ts":
		'import { login } from "./auth.js";\nexport const boot = (): string => login("a");',
	"src/app.test.ts":
		'import { boot } from "./app.js";\nexport const t = boot();',
	"src/unrelated.test.ts": "export const u = 1;",
};

const sorted = (values: Iterable<string> | undefined): string[] =>
	[...(values ?? [])].sort();

afterEach(cleanupTempWorkspaces);

describe("loadImportGraph", () => {
	it("builds the graph from real files and persists the index", async () => {
		const dir = createTempWorkspace("importgraph");
		writeFiles(dir, {
			"src/auth.ts": "export function login(): string { return 'ok'; }",
			"src/app.ts":
				'import { login } from "./auth.js";\nexport const boot = () => login();',
		});

		const graph = await loadImportGraph(dir);

		expect(sorted(graph.dependents.get("src/auth.ts"))).toEqual(["src/app.ts"]);
		expect(await loadSymbolGraph(defaultGraphDir(dir))).not.toBeNull();
	});
});

describe("traceBlastRadius", () => {
	it("propagates a signature change to its dependents", async () => {
		const dir = createTempWorkspace("blast");
		writeFiles(dir, {
			// Signature change vs AUTH_BEFORE: extra parameter.
			"src/auth.ts":
				"export function login(name: string, strict: boolean): string { return name; }",
			"src/app.ts":
				'import { login } from "./auth.js";\nexport const boot = (): string => login("a", true);',
			"src/other.ts": "export const other = 1;",
		});

		const radius = await traceBlastRadius(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore,
		});

		expect(radius?.changed[0]?.classification).toBe("breaking");
		expect(radius?.affectedFiles).toEqual(["src/app.ts", "src/auth.ts"]);
	});

	it("does not propagate a body-only edit past the changed file", async () => {
		const dir = createTempWorkspace("blast");
		writeFiles(dir, {
			// Body change vs AUTH_BEFORE: same signature, different return expr.
			"src/auth.ts":
				"export function login(name: string): string { return name.trim(); }",
			"src/app.ts":
				'import { login } from "./auth.js";\nexport const boot = (): string => login("a");',
		});

		const radius = await traceBlastRadius(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore,
		});

		expect(radius?.changed[0]?.classification).toBe("internal");
		expect(radius?.affectedFiles).toEqual(["src/auth.ts"]);
	});

	it("returns null when git is unavailable and no changed set is given", async () => {
		const dir = createTempWorkspace("blast");
		writeFiles(dir, { "src/a.ts": "export const a = 1;" });

		// A fresh temp dir is not a git repository, so the diff cannot resolve.
		expect(await traceBlastRadius(dir, { baseRef: "HEAD~1" })).toBeNull();
	});
});

describe("traceTestImpact", () => {
	it("selects zero tests for a comment-only change", async () => {
		const dir = createTempWorkspace("testimpact");
		writeFiles(dir, {
			...APP_FIXTURE,
			"src/auth.ts": `${AUTH_BEFORE}\n// clarifying comment`,
		});

		const result = await traceTestImpact(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore,
		});

		expect(result?.radius.changed[0]?.classification).toBe("non-impacting");
		expect(result?.tests.affectedTests).toEqual([]);
		expect(result?.tests.totalTests).toBe(2);
	});

	it("still selects the tests of transitive importers for a body-only change", async () => {
		const dir = createTempWorkspace("testimpact");
		writeFiles(dir, {
			...APP_FIXTURE,
			"src/auth.ts":
				"export function login(name: string): string { return name.trim(); }",
		});

		const result = await traceTestImpact(dir, {
			changedFiles: ["src/auth.ts"],
			readBefore,
		});

		expect(result?.radius.changed[0]?.classification).toBe("internal");
		expect(result?.tests.affectedTests).toEqual(["src/app.test.ts"]);
	});

	it("returns null when git is unavailable and no changed set is given", async () => {
		const dir = createTempWorkspace("testimpact");
		writeFiles(dir, { "src/a.ts": "export const a = 1;" });

		expect(await traceTestImpact(dir)).toBeNull();
	});
});
