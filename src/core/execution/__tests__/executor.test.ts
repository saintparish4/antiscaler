import { describe, it, expect, vi } from "vitest";
import { executeTask } from "../executor.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

describe("executeTask command parsing", () => {
  it("preserves quoted args as a single argv element", async () => {
    const { execa } = await import("execa");

    await executeTask(
      "echo-quoted",
      { command: `node -e "console.log('x y')"` },
      "npm",
      process.cwd(),
    );

    expect(execa).toHaveBeenCalledWith(
      "node",
      ["-e", "console.log('x y')"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("falls back to `<pm> run <name>` when no command is provided", async () => {
    const { execa } = await import("execa");
    (execa as unknown as { mockClear: () => void }).mockClear();

    await executeTask("build", {}, "pnpm", process.cwd());

    expect(execa).toHaveBeenCalledWith(
      "pnpm",
      ["run", "build"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("collapses runs of whitespace cleanly", async () => {
    const { execa } = await import("execa");
    (execa as unknown as { mockClear: () => void }).mockClear();

    await executeTask(
      "spaced",
      { command: "node    --version" },
      "npm",
      process.cwd(),
    );

    expect(execa).toHaveBeenCalledWith(
      "node",
      ["--version"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });
});
