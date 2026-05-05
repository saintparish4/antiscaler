import { execSync } from "node:child_process";
import type { RuntimeAdapter } from "../types.js";

export const nodeAdapter: RuntimeAdapter = {
	name: "node",

	available(): boolean {
		try {
			execSync("node --version", { stdio: "pipe" });
			return true;
		} catch {
			return false;
		}
	},

	version(): string | null {
		try {
			return execSync("node --version", { stdio: "pipe" }).toString().trim();
		} catch {
			return null;
		}
	},
};
