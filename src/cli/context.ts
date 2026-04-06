import type { AntiscaleContext } from "../types/index.js";
import { loadConfig } from "../core/config/loader.js";
import { detectProject } from "../core/detection/project.js";
import { buildGraph } from "../core/graph/plannet.js";

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
