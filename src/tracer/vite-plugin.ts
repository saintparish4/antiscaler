/**
 * @module
 * Vite plugin for module-level tracing.
 *
 *   import { antiscalerVitePlugin } from "antiscaler/tracer";
 *   export default { plugins: [antiscalerVitePlugin()] };
 */

import type { TraceFile, TracerOptions } from "./types.js";
import { newSessionId, writeTrace } from "./writer.js";

interface VitePlugin {
	name: string;
	configResolved?: (cfg: { root: string }) => void;
	transform?: (_code: string, id: string) => null;
	closeBundle?: () => Promise<void>;
}

export function antiscalerVitePlugin(options: TracerOptions = {}): VitePlugin {
	const sessionId = options.sessionId ?? newSessionId();
	const startedAt = Date.now();
	const seen = new Set<string>();
	let root = process.cwd();

	return {
		name: "antiscaler-tracer",
		configResolved(cfg) {
			root = cfg.root;
		},
		transform(_code, id) {
			if (id && !id.includes("node_modules")) {
				seen.add(id.split("?")[0] ?? id);
			}
			return null;
		},
		async closeBundle() {
			const trace: TraceFile = {
				schemaVersion: 1,
				sessionId,
				startedAt,
				endedAt: Date.now(),
				framework: "vite",
				modules: [...seen].sort().map((file) => ({ file })),
				routes: [],
			};
			await writeTrace(root, trace, options.outDir);
		},
	};
}
