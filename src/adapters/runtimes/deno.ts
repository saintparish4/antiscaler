import type { RuntimeAdapter } from "../types.js";
import { createVersionProbe } from "./probe.js";

// "deno --version" outputs deno, v8 and typescript versions on separate
// lines; only the first identifies the runtime.
const probe = createVersionProbe(
	"deno",
	(output) => output.trim().split("\n")[0]?.trim() ?? null,
);

export const denoAdapter: RuntimeAdapter = {
	name: "deno",

	available(): boolean {
		return probe() !== null;
	},

	version(): string | null {
		return probe();
	},
};
