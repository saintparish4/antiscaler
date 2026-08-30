import type { RuntimeAdapter } from "../types.js";

export const nodeAdapter: RuntimeAdapter = {
	name: "node",

	// Both answers are already in this process. Spawning `node --version` to
	// ask the running Node its own version cost ~8 ms for a value held in
	// memory, and a PATH lookup could even have found a different Node than
	// the one executing this code.
	available(): boolean {
		return typeof process.versions.node === "string";
	},

	version(): string | null {
		return process.version;
	},
};
