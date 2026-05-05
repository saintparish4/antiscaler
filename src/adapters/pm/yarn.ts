import { execa } from "execa";
import type { PackageManagerAdapter } from "../types.js";

export const yarnAdapter: PackageManagerAdapter = {
	name: "yarn",

	async runScript(scriptName: string, cwd: string): Promise<void> {
		await execa("yarn", ["run", scriptName], { cwd, stdio: "inherit" });
	},

	async install(cwd: string): Promise<void> {
		await execa("yarn", ["install"], { cwd, stdio: "inherit" });
	},
};
