import type { AntiscaleContext } from "../types/index.js";
import type { RunOptions } from "../core/execution/runner.js";
import { loadConfig } from "../core/config/loader.js";
import { detectProject } from "../core/detection/project.js";
import { buildGraph } from "../core/graph/planner.js";
import { PluginRegistry } from "../core/plugins/registry.js";
import { wrapFrameworkAsPlugin } from "../adapters/frameworks/plugin.js";
import { nextAdapter } from "../adapters/frameworks/next.js";
import { viteAdapter } from "../adapters/frameworks/vite.js";
import { genericAdapter } from "../adapters/frameworks/generic.js";
import { loadPackageGraph, tasksFromPackageGraph } from "../core/graph/package-graph.js";

export async function createContext(
  cwd: string = process.cwd(),
): Promise<AntiscaleContext> {
  const config = await loadConfig(cwd);
  if (config.workspace?.enabled) {
    const pkgGraph = await loadPackageGraph(cwd);
    config.tasks = tasksFromPackageGraph(pkgGraph, config.tasks);
  }
  const { pm, runtime, framework } = detectProject(cwd);
  const cacheDir = config.cache.directory;

  const plugins = new PluginRegistry();
  plugins.register(wrapFrameworkAsPlugin(nextAdapter));
  plugins.register(wrapFrameworkAsPlugin(viteAdapter));
  plugins.register(wrapFrameworkAsPlugin(genericAdapter));

  await plugins.runOnDetect({
    cwd,
    pm: pm.name,
    framework: framework?.name ?? null,
    tasks: config.tasks,
  });

  const graph = buildGraph(config);

  return {
    cwd,
    config,
    pm: pm.name,
    runtime: { primary: runtime.name, fallback: "node" },
    framework: framework?.name ?? null,
    graph,
    cacheDir,
    plugins,
  };
}

/**
 * Lifts an AntiscaleContext into the flat RunOptions shape that the runner
 * expects. Every CLI command that calls runTasksWithDeps should go through
 * this helper -- it is the single source of truth for context-to-options
 * translation.
 */
export function toRunOptions(
  ctx: AntiscaleContext,
  overrides: { concurrency?: number } = {},
): RunOptions {
  return {
    cwd: ctx.cwd,
    cacheDir: ctx.cacheDir,
    pm: ctx.pm,
    config: ctx.config,
    tasks: ctx.config.tasks,
    plugins: ctx.plugins,
    ...(overrides.concurrency !== undefined
      ? { concurrency: overrides.concurrency }
      : {}),
  };
}
