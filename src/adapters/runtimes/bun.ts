import { execSync } from "node:child_process";
import type { RuntimeAdapter } from "../types.js";

export const bunAdapter: RuntimeAdapter = {
	name: "bun",

	available(): boolean {
		try {
			execSync("bun --version", { stdio: "pipe" });
			return true;
		} catch {
			return false;
		}
	},

	version(): string | null {
		try {
			return execSync("bun --version", { stdio: "pipe" }).toString().trim();
		} catch {
			return null;
		}
	},
};
