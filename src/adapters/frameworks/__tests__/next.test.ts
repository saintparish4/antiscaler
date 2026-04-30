import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { nextAdapter } from "../next.js";

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "antiscale-next-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe("nextAdapter.detect", () => {
  it("returns true when next is in dependencies", () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "14.0.0" } }),
    );
    expect(nextAdapter.detect(dir)).toBe(true);
  });

  it("returns true when next is in devDependencies", () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ devDependencies: { next: "14.0.0" } }),
    );
    expect(nextAdapter.detect(dir)).toBe(true);
  });

  it("returns false when next is missing entirely", () => {
    const dir = makeTmpDir();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { react: "18.0.0" } }),
    );
    expect(nextAdapter.detect(dir)).toBe(false);
  });

  it("returns false when package.json does not exist", () => {
    const dir = makeTmpDir();
    expect(nextAdapter.detect(dir)).toBe(false);
  });

  it("returns false on malformed package.json (does not throw)", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "package.json"), "{ this is not json");
    expect(nextAdapter.detect(dir)).toBe(false);
  });

  it("returns false when both dep blocks are missing", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
    expect(nextAdapter.detect(dir)).toBe(false);
  });
});

describe("nextAdapter commands", () => {
  it("devCommand returns 'next dev'", () => {
    expect(nextAdapter.devCommand()).toBe("next dev");
  });
  it("buildCommand returns 'next build'", () => {
    expect(nextAdapter.buildCommand()).toBe("next build");
  });
});
