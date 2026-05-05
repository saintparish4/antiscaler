import type { FrameworkAdapter } from "../types.js";

/**
 * Fallback adapter used when no known framework is detected
 * Commands fall back to the package manager's run scripts
 */
export const genericAdapter: FrameworkAdapter = {
	name: "generic",

	detect(_cwd: string): boolean {
		return true; // always matches -- used only as a fallback
	},

	devCommand(): string {
		return "dev";
	},

	buildCommand(): string {
		return "build";
	},
};
