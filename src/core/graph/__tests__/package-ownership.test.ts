import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PackageGraph } from "../package-graph.js";
import { packageForFile } from "../package-graph.js";

function graph(packages: Array<{ name: string; dir: string }>): PackageGraph {
	return {
		packages: packages.map(({ name, dir }) => ({
			name,
			dir,
			manifest: { name },
		})),
		edges: new Map(),
	};
}

const ROOT = path.resolve("/repo");
const WEB_DIR = path.join(ROOT, "packages", "web");
const WEB = graph([{ name: "web", dir: WEB_DIR }]);

describe("packageForFile", () => {
	it("returns the owning package", () => {
		expect(
			packageForFile(path.join(WEB_DIR, "src", "index.ts"), WEB)?.name,
		).toBe("web");
	});

	it("accepts a file directly inside the package directory", () => {
		expect(packageForFile(path.join(WEB_DIR, "index.ts"), WEB)?.name).toBe(
			"web",
		);
	});

	it("accepts a deeply nested file", () => {
		expect(
			packageForFile(path.join(WEB_DIR, "src", "a", "b.ts"), WEB)?.name,
		).toBe("web");
	});

	it("rejects a sibling directory", () => {
		expect(
			packageForFile(path.join(ROOT, "packages", "docs", "a.ts"), WEB),
		).toBeNull();
	});

	/**
	 * `packages/web` must not swallow `packages/website` — a plain prefix test
	 * does exactly that.
	 */
	it("rejects a sibling whose name extends this one", () => {
		expect(
			packageForFile(path.join(ROOT, "packages", "website", "a.ts"), WEB),
		).toBeNull();
	});

	/**
	 * Regression test for a Windows-only bug. Package dirs come from fast-glob,
	 * which returns POSIX separators on every host; the paths matched against
	 * them come from git, a tracer, or `path.join`, which are native. On
	 * Windows the two never share a textual prefix, so every file looked like
	 * it belonged to no package — silently emptying `build --scope` and the
	 * `trace analyze` package breakdown.
	 */
	it("matches a POSIX-separated package dir against a native-separated file", () => {
		const posix = graph([{ name: "web", dir: WEB_DIR.replace(/\\/g, "/") }]);
		expect(packageForFile(path.join(WEB_DIR, "index.ts"), posix)?.name).toBe(
			"web",
		);
	});

	it("matches a native-separated package dir against a POSIX-separated file", () => {
		const posixFile = path.join(WEB_DIR, "index.ts").replace(/\\/g, "/");
		expect(packageForFile(posixFile, WEB)?.name).toBe("web");
	});

	it("returns null for a file outside every package", () => {
		expect(
			packageForFile(path.join(ROOT, "scripts", "release.ts"), WEB),
		).toBeNull();
	});

	it("returns null when the workspace has no packages", () => {
		expect(packageForFile(path.join(ROOT, "a.ts"), graph([]))).toBeNull();
	});

	// Nested packages are legal, and the innermost one owns the file — the
	// upward directory walk finds it first no matter how packages are ordered.
	it("attributes a file to the innermost package", () => {
		const outerFirst = graph([
			{ name: "all", dir: path.join(ROOT, "packages") },
			{ name: "web", dir: WEB_DIR },
		]);
		const innerFirst = graph([
			{ name: "web", dir: WEB_DIR },
			{ name: "all", dir: path.join(ROOT, "packages") },
		]);
		const file = path.join(WEB_DIR, "index.ts");

		expect(packageForFile(file, outerFirst)?.name).toBe("web");
		expect(packageForFile(file, innerFirst)?.name).toBe("web");
	});

	it("falls back to the outer package for a file between them", () => {
		const nested = graph([
			{ name: "all", dir: path.join(ROOT, "packages") },
			{ name: "web", dir: WEB_DIR },
		]);
		expect(
			packageForFile(path.join(ROOT, "packages", "shared.ts"), nested)?.name,
		).toBe("all");
	});
});
