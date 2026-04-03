import { existsSync, readFileSync } from "fs";
import path from "path";
import type { FrameworkAdapter } from "../types.js";

export const nextAdapter: FrameworkAdapter = {
  name: "next",

  detect(cwd: string): boolean {
    const pkgPath = path.join(cwd, "package.json");
    if (!existsSync(pkgPath)) return false;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
        string,
        unknown
      >;
      const deps = {
        ...(pkg["dependencies"] as Record<string, unknown> | undefined),
        ...(pkg["devDependencies"] as Record<string, unknown> | undefined),
      };
      return "next" in deps;
    } catch {
      return false;
    }
  },

  devCommand(): string {
    return "next dev";
  },

  buildCommand(): string {
    return "next build";
  },
};
