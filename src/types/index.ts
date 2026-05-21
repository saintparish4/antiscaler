import type * as z from "zod";
import type {
	antiscaleConfigSchema,
	taskConfigSchema,
} from "../core/config/schema.js";
import type { PluginRegistry } from "../core/plugins/registry.js";

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
	/** Returns the direct dependencies of a task (tasks it depends ON). */
	getDependencies(task: string): ReadonlySet<string>;
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
	/**
	 * True when lintOnlyForNonCritical is enabled and the current changes do
	 * not affect any critical route. Commands should restrict execution to
	 * lint tasks only when this flag is set.
	 */
	lintOnly?: boolean;
}
