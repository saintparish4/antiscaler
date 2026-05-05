import type { z } from "zod";
import type { PluginRegistry } from "../core/plugins/registry.js";
import type {
  antiscaleConfigSchema,
  taskConfigSchema,
} from "../core/config/schema.js";

// User-facing config (the object passed to defineConfig
export type AntiscaleConfig = z.input<typeof antiscaleConfigSchema>;

// Fully-validated config with all defaults applied
export type ResolvedAntiscaleConfig = z.output<typeof antiscaleConfigSchema>;

export type Strategy = ResolvedAntiscaleConfig["strategy"];

export type TaskConfig = z.infer<typeof taskConfigSchema>;

export type CacheConfig = ResolvedAntiscaleConfig["cache"];

//Built by the DAG layer (core/graph): class implements this contract
export interface TaskGraph {
  addTask(name: string): void;
  addDependency(task: string, dep: string): void;
  toLevels(target: string): string[][];
}

export interface RuntimeInfo {
  primary: string;
  fallback: string;
}

export interface AntiscaleContext {
  cwd: string;
  config: ResolvedAntiscaleConfig;
  pm: string;
  runtime: RuntimeInfo;
  framework: string | null;
  graph: TaskGraph;
  cacheDir: string;
  plugins: PluginRegistry;
  packageScopes?: string[];
}
