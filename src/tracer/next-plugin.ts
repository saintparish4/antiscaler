/**
 * @module
 * Next.js webpack plugin for module-level tracing. Consumed by the user as:
 *
 *   const { antiscalerNextPlugin } = require("antiscaler/tracer");
 *   module.exports = {
 *     webpack(config) {
 *       config.plugins.push(antiscalerNextPlugin());
 *       return config;
 *     },
 *   };
 */

import type { TraceFile, TracerOptions } from "./types.js";
import { newSessionId, writeTrace } from "./writer.js";

interface WebpackCompiler {
	hooks: {
		afterCompile: {
			tap: (name: string, cb: (compilation: unknown) => void) => void;
		};
		done: { tapPromise: (name: string, cb: () => Promise<void>) => void };
	};
	context: string;
}

export function antiscalerNextPlugin(options: TracerOptions = {}) {
	const sessionId = options.sessionId ?? newSessionId();
	const startedAt = Date.now();
	const seen = new Set<string>();

	return {
		apply(compiler: WebpackCompiler) {
			compiler.hooks.afterCompile.tap("AntiscalerTracer", (compilation) => {
				const c = compilation as {
					modules: Iterable<{ resource?: string }>;
				};
				for (const m of c.modules) {
					if (m.resource && !m.resource.includes("node_modules")) {
						seen.add(m.resource);
					}
				}
			});

			compiler.hooks.done.tapPromise("AntiscalerTracer", async () => {
				const trace: TraceFile = {
					schemaVersion: 1,
					sessionId,
					startedAt,
					endedAt: Date.now(),
					framework: "next",
					modules: [...seen].sort().map((file) => ({ file })),
					routes: [],
				};
				await writeTrace(compiler.context, trace, options.outDir);
			});
		},
	};
}
