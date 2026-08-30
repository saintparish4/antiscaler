import type { RuntimeAdapter } from "../types.js";
import { createVersionProbe } from "./probe.js";

const probe = createVersionProbe("bun");

export const bunAdapter: RuntimeAdapter = {
	name: "bun",

	available(): boolean {
		return probe() !== null;
	},

	version(): string | null {
		return probe();
	},
};
