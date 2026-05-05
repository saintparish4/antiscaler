/**
 * @module
 * Lift the existing FrameworkAdapter contract into a BuildPlugin so
 * adapters become first-class plugins without being rewritten.
 */

import type { BuildPlugin } from "../../core/plugins/types.js";
import type { FrameworkAdapter } from "../types.js";

export const wrapFrameworkAsPlugin = (a: FrameworkAdapter): BuildPlugin => ({
	name: `framework:${a.name}`,
	hooks: {
		onDetect: async (ctx) => {
			if (!(await Promise.resolve(a.detect(ctx.cwd)))) return;
			ctx.framework = ctx.framework ?? a.name;
			// Auto-register dev / build commands when the user hasn't defined them.
			if (!ctx.tasks.dev?.command) {
				ctx.tasks.dev = { ...ctx.tasks.dev, command: a.devCommand() };
			}
			if (!ctx.tasks.build?.command) {
				ctx.tasks.build = {
					...ctx.tasks.build,
					command: a.buildCommand(),
				};
			}
		},
	},
});
