/**
 * Wrap your config object with this helper to get TypeScript type-checking
 * and IDE autocomplete. The value is returned as-is at runtime.
 *
 * @example
 * ```typescript
 * import { defineConfig } from "antiscaler";
 *
 * export default defineConfig({
 *   tasks: {
 *     build: { command: "npm run build", inputs: ["src/**/*"] },
 *   },
 * });
 * ```
 */
export { defineConfig } from "./core/config/loader.js";

/**
 * The raw config shape accepted by `defineConfig`. All fields are optional;
 * Antiscaler applies defaults for anything not specified.
 */
export type { AntiscaleConfig } from "./types/index.js";

/**
 * The `cache` sub-object of `ResolvedAntiscaleConfig`, with all defaults
 * applied.
 */
export type { CacheConfig } from "./types/index.js";

/**
 * The fully-validated config with every default filled in. This is the type
 * of the config object that Antiscaler uses internally after loading.
 */
export type { ResolvedAntiscaleConfig } from "./types/index.js";

/** `"adaptive"` or `"strict"`. */
export type { Strategy } from "./types/index.js";

/**
 * A single task entry inside `AntiscaleConfig["tasks"]`.
 *
 * @example
 * ```typescript
 * const myTask: TaskConfig = {
 *   command: "npm run build",
 *   inputs: ["src/**/*"],
 *   dependsOn: ["typecheck"],
 * };
 * ```
 */
export type { TaskConfig } from "./types/index.js";
