/**
 * @module
 * PluginRegistry: holds registered BuildPlugins and invokes their hooks.
 * Hook errors are isolated per plugin and routed to the error hook; one
 * misbehaving plugin never breaks the build.
 *
 * @see cli/render/plugin-errors.ts for the reporting hook the CLI installs.
 */

import type { TaskRunResult } from "../execution/runner.js";
import type {
	BuildPlugin,
	DetectionContext,
	PluginErrorHook,
} from "./types.js";

/**
 * Swallowing is the right default here: `core` has no output channel, and a
 * plugin throwing must never break the build. Callers that can report — the
 * CLI wires `reportPluginError` — pass their own hook.
 */
const swallowErrors: PluginErrorHook = () => {};

export class PluginRegistry {
	private plugins: BuildPlugin[] = [];
	private onError: PluginErrorHook;

	constructor(onError: PluginErrorHook = swallowErrors) {
		this.onError = onError;
	}

	register(plugin: BuildPlugin): void {
		this.plugins.push(plugin);
	}

	list(): readonly BuildPlugin[] {
		return this.plugins;
	}

	async runOnDetect(ctx: DetectionContext): Promise<void> {
		for (const p of this.plugins) {
			const hook = p.hooks?.onDetect;
			if (!hook) continue;
			try {
				await hook(ctx);
			} catch (err) {
				this.onError(err, p.name, "onDetect");
			}
		}
	}

	/**
	 * Extra hash inputs from every plugin, deduped and sorted so the cache key
	 * does not depend on plugin registration order.
	 */
	async runOnHash(task: string, files: readonly string[]): Promise<string[]> {
		const acc = new Set<string>();
		for (const p of this.plugins) {
			const hook = p.hooks?.onHash;
			if (!hook) continue;
			try {
				const out = await hook(task, Array.from(files));
				if (Array.isArray(out)) for (const v of out) acc.add(v);
			} catch (err) {
				this.onError(err, p.name, "onHash", task);
			}
		}
		return [...acc].sort();
	}

	/**
	 * True when the task should be skipped. One plugin vetoing is enough — a
	 * plugin that knows the work is unnecessary is not outvoted by plugins
	 * that merely have no opinion.
	 */
	async runOnBeforeExecute(task: string): Promise<boolean> {
		let skip = false;
		for (const p of this.plugins) {
			const hook = p.hooks?.onBeforeExecute;
			if (!hook) continue;
			try {
				const out = await hook(task);
				if (out === false) skip = true;
			} catch (err) {
				this.onError(err, p.name, "onBeforeExecute", task);
			}
		}
		return skip;
	}

	async runOnAfterExecute(task: string, result: TaskRunResult): Promise<void> {
		for (const p of this.plugins) {
			const hook = p.hooks?.onAfterExecute;
			if (!hook) continue;
			try {
				await hook(task, result);
			} catch (err) {
				this.onError(err, p.name, "onAfterExecute", task);
			}
		}
	}
}
