import type { AntiscaleContext } from "../types/index.js";
import type { RunOptions } from "../core/execution/runner.js";
import { loadConfig } from "../core/config/loader.js";
import { detectProject } from "../core/detection/project.js";
import { buildGraph } from "../core/graph/planner.js";

export async function createContext(
  cwd: string = process.cwd(),
): Promise<AntiscaleContext> {
  const config = await loadConfig(cwd);
  const { pm, runtime, framework } = detectProject(cwd);
  const graph = buildGraph(config);
  const cacheDir = config.cache.directory;

  return {
    cwd,
    config,
    pm: pm.name,
    runtime: { primary: runtime.name, fallback: "node" },
    framework: framework?.name ?? null,
    graph,
    cacheDir,
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
    ...(overrides.concurrency !== undefined
      ? { concurrency: overrides.concurrency }
      : {}),
  };
}
