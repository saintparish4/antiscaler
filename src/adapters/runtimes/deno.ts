import { execSync } from "child_process";
import type { RuntimeAdapter } from "../types.js";

export const denoAdapter: RuntimeAdapter = {
  name: "deno",

  available(): boolean {
    try {
      execSync("deno --version", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  },

  version(): string | null {
    try {
      // "deno --version" outputs multiple lines; grab the first
      const out = execSync("deno --version", { stdio: "pipe" })
        .toString()
        .trim();
      return out.split("\n")[0]?.trim() ?? null;
    } catch {
      return null;
    }
  },
};
