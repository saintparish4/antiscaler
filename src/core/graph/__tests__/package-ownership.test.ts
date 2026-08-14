import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PackageGraph } from "../package-graph.js";
import { isInsideDirectory, packageForFile } from "../package-graph.js";

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

describe("isInsideDirectory", () => {
	it("accepts a file directly inside the directory", () => {
		expect(isInsideDirectory(WEB_DIR, path.join(WEB_DIR, "index.ts"))).toBe(
			true,
		);
	});

	it("accepts a deeply nested file", () => {
		expect(
			isInsideDirectory(WEB_DIR, path.join(WEB_DIR, "src", "a", "b.ts")),
		).toBe(true);
	});

	it("rejects a sibling directory", () => {
		expect(
			isInsideDirectory(WEB_DIR, path.join(ROOT, "packages", "docs", "a.ts")),
		).toBe(false);
	});

	/**
	 * `packages/web` must not swallow `packages/website` — the prefix test this
	 * replaced did exactly that.
	 */
	it("rejects a sibling whose name extends this one", () => {
		expect(
			isInsideDirectory(
				WEB_DIR,
				path.join(ROOT, "packages", "website", "a.ts"),
			),
		).toBe(false);
	});

	/**
	 * Regression test for a Windows-only bug. Package dirs come from fast-glob,
	 * which returns POSIX separators on every host; the paths matched against
	 * them come from git, a tracer, or `path.join`, which are native. On
	 * Windows the two never share a textual prefix, so every file looked like
	 * it belonged to no package — silently emptying `build --scope` and the
	 * `trace analyze` package breakdown.
	 */
	it("matches a POSIX-separated directory against a native-separated file", () => {
		const posixDir = WEB_DIR.replace(/\\/g, "/");
		expect(isInsideDirectory(posixDir, path.join(WEB_DIR, "index.ts"))).toBe(
			true,
		);
	});

	it("matches a native-separated directory against a POSIX-separated file", () => {
		const posixFile = path.join(WEB_DIR, "index.ts").replace(/\\/g, "/");
		expect(isInsideDirectory(WEB_DIR, posixFile)).toBe(true);
	});
});

describe("packageForFile", () => {
	it("returns the owning package", () => {
		const owner = packageForFile(
			path.join(WEB_DIR, "src", "index.ts"),
			graph([{ name: "web", dir: WEB_DIR }]),
		);

		expect(owner?.name).toBe("web");
	});

	it("returns null for a file outside every package", () => {
		const owner = packageForFile(
			path.join(ROOT, "scripts", "release.ts"),
			graph([{ name: "web", dir: WEB_DIR }]),
		);

		expect(owner).toBeNull();
	});

	it("returns null when the workspace has no packages", () => {
		expect(packageForFile(path.join(ROOT, "a.ts"), graph([]))).toBeNull();
	});

	// Nested packages are legal; first match wins, and `packages` is sorted by
	// directory, so the more specific package is not reliably first — callers
	// depending on that should not nest.
	it("attributes a file to a single package", () => {
		const owner = packageForFile(
			path.join(WEB_DIR, "index.ts"),
			graph([
				{ name: "web", dir: WEB_DIR },
				{ name: "all", dir: path.join(ROOT, "packages") },
			]),
		);

		expect(owner?.name).toBe("web");
	});
});
