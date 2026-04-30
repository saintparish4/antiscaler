import { describe, it, expect, vi, beforeEach } from "vitest";
import { pnpmAdapter } from "../pnpm.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

describe("pnpmAdapter", () => {
  beforeEach(async () => {
    const { execa } = await import("execa");
    (execa as unknown as { mockClear: () => void }).mockClear();
  });

  it("name is 'pnpm'", () => {
    expect(pnpmAdapter.name).toBe("pnpm");
  });

  it("runScript invokes `pnpm run <name>`", async () => {
    const { execa } = await import("execa");
    await pnpmAdapter.runScript("test", "/work");
    expect(execa).toHaveBeenCalledWith(
      "pnpm",
      ["run", "test"],
      expect.objectContaining({ cwd: "/work", stdio: "inherit" }),
    );
  });

  it("install invokes `pnpm install`", async () => {
    const { execa } = await import("execa");
    await pnpmAdapter.install("/work");
    expect(execa).toHaveBeenCalledWith(
      "pnpm",
      ["install"],
      expect.objectContaining({ cwd: "/work", stdio: "inherit" }),
    );
  });
});
