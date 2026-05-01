/**
 * @module
 * PluginRegistry: holds registered BuildPlugins and invokes their hooks.
 * Hook errors are isolated per plugin and routed to the error hook; one
 * misbehaving plugin never breaks the build.
 */

import type {
  BuildPlugin,
  DetectionContext,
  PluginErrorHook,
} from "./types.js";
import type { TaskRunResult } from "../execution/runner.js";

const defaultErrorHook: PluginErrorHook = (err, pluginName, hook, task) => {
  const where = task
    ? `${pluginName}.${hook} (${task})`
    : `${pluginName}.${hook}`;
  console.warn(`[antiscaler plugin] ${where} threw`, err);
};

export class PluginRegistry {
  private plugins: BuildPlugin[] = [];
  private onError: PluginErrorHook;

  constructor(onError: PluginErrorHook = defaultErrorHook) {
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

  // Composes all plugin onHash returns into a single sorted deduped array
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

  // Returns true if ANY plugin returned false (i.e. "skip this task")
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
