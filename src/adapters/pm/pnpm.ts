import { execa } from "execa";
import type { PackageManagerAdapter } from "../types.js";

export const pnpmAdapter: PackageManagerAdapter = {
	name: "pnpm",

	async runScript(scriptName: string, cwd: string): Promise<void> {
		await execa("pnpm", ["run", scriptName], { cwd, stdio: "inherit" });
	},

	async install(cwd: string): Promise<void> {
		await execa("pnpm", ["install"], { cwd, stdio: "inherit" });
	},
};
