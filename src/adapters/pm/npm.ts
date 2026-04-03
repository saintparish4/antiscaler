import { execa } from "execa";
import type { PackageManagerAdapter } from "../types.js";

export const npmAdapter: PackageManagerAdapter = {
  name: "npm",

  async runScript(scriptName: string, cwd: string): Promise<void> {
    await execa("npm", ["run", scriptName], { cwd, stdio: "inherit" });
  },

  async install(cwd: string): Promise<void> {
    await execa("npm", ["install"], { cwd, stdio: "inherit" });
  },
};
