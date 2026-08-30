import type { PackageManagerAdapter } from "../types.js";

// execa is loaded per call, not at module scope: detection/packageManager.ts
// imports all three adapters, so a static import put execa (and cross-spawn,
// which, human-signals) on the startup path of every command — including the
// ones that never run a script. Same reasoning as executor.ts and vcs/git.ts.

export const npmAdapter: PackageManagerAdapter = {
	name: "npm",

	async runScript(scriptName: string, cwd: string): Promise<void> {
		const { execa } = await import("execa");
		await execa("npm", ["run", scriptName], { cwd, stdio: "inherit" });
	},

	async install(cwd: string): Promise<void> {
		const { execa } = await import("execa");
		await execa("npm", ["install"], { cwd, stdio: "inherit" });
	},
};
