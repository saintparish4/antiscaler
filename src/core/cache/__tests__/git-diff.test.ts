import { describe, expect, it } from "vitest";
import type {
  PackageGraph,
  WorkspacePackage,
} from "../../graph/package-graph.js";
import { changedFilesToPackages } from "../git-diff.js";

function makePkg(name: string, dir: string): WorkspacePackage {
  return {
    name,
    dir,
    manifest: { name },
  };
}

describe("changedFilesToPackages", () => {
  it("maps file inside package dir to that package", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = {
      packages: [makePkg("utils", "/workspace/packages/utils")],
      edges: new Map(),
    };
    const result = changedFilesToPackages(
      ["packages/utils/src/index.ts"],
      graph,
      cwd,
    );
    expect(result.has("utils")).toBe(true);
  });

  it("ignores files outside all package dirs", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = {
      packages: [makePkg("utils", "/workspace/packages/utils")],
      edges: new Map(),
    };
    const result = changedFilesToPackages(
      ["README.md", ".github/workflows/ci.yml"],
      graph,
      cwd,
    );
    expect(result.size).toBe(0);
  });

  it("distinguishes prefix-similar package dirs (utils vs utils-extra)", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = {
      packages: [
        makePkg("utils", "/workspace/packages/utils"),
        makePkg("utils-extra", "/workspace/packages/utils-extra"),
      ],
      edges: new Map(),
    };
    const result = changedFilesToPackages(
      ["packages/utils-extra/src/foo.ts"],
      graph,
      cwd,
    );
    expect(result.has("utils-extra")).toBe(true);
    expect(result.has("utils")).toBe(false);
  });

  it("assigns file to first matching package only", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = {
      packages: [
        makePkg("a", "/workspace/packages/a"),
        makePkg("b", "/workspace/packages/a"), // pathological: same dir
      ],
      edges: new Map(),
    };
    const result = changedFilesToPackages(
      ["packages/a/src/index.ts"],
      graph,
      cwd,
    );
    expect(result.size).toBe(1);
    expect(result.has("a")).toBe(true);
  });

  it("handles empty file list", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = {
      packages: [makePkg("x", "/workspace/packages/x")],
      edges: new Map(),
    };
    const result = changedFilesToPackages([], graph, cwd);
    expect(result.size).toBe(0);
  });

  it("handles empty package list", () => {
    const cwd = "/workspace";
    const graph: PackageGraph = { packages: [], edges: new Map() };
    const result = changedFilesToPackages(["any/file.ts"], graph, cwd);
    expect(result.size).toBe(0);
  });
});
