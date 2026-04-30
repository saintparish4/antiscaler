import { describe, it, expect } from "vitest";
import { genericAdapter } from "../generic.js";

describe("genericAdapter", () => {
  it("detect always returns true (fallback adapter)", () => {
    expect(genericAdapter.detect("/any/path")).toBe(true);
    expect(genericAdapter.detect("")).toBe(true);
  });

  it("devCommand returns 'dev'", () => {
    expect(genericAdapter.devCommand()).toBe("dev");
  });

  it("buildCommand returns 'build'", () => {
    expect(genericAdapter.buildCommand()).toBe("build");
  });

  it("name is 'generic'", () => {
    expect(genericAdapter.name).toBe("generic");
  });
});
