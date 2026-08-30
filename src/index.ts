/**
 * The supported public API surface of linkctl.
 *
 * Everything re-exported from this module is covered by the project's semver
 * stability guarantee as of v1.0.0: no breaking changes in a minor or patch
 * release. Symbols reachable through deep import paths (`linkctl/dist/...`)
 * are `@internal` and may change at any time — depend only on what is exported
 * here and from `linkctl/tracer`.
 *
 * @packageDocumentation
 */

/**
 * Wrap your config object with this helper to get TypeScript type-checking
 * and IDE autocomplete. The value is returned as-is at runtime.
 *
 * @example
 * ```typescript
 * import { defineConfig } from "linkctl";
 *
 * export default defineConfig({
 *   tasks: {
 *     build: { command: "npm run build", inputs: ["src/**"] },
 *   },
 * });
 * ```
 *
 * @public
 */
export { defineConfig } from "./core/config/loader.js";
/**
 * The raw config shape accepted by `defineConfig`. All fields are optional;
 * Linkctl applies defaults for anything not specified.
 *
 * @public
 */
/**
 * The `cache` sub-object of `ResolvedLinkctlConfig`, with all defaults
 * applied.
 *
 * @public
 */
/**
 * The fully-validated config with every default filled in. This is the type
 * of the config object that Linkctl uses internally after loading.
 *
 * @public
 */
/**
 * `"adaptive"` or `"strict"`.
 *
 * @public
 */
/**
 * A single task entry inside `LinkctlConfig["tasks"]`.
 *
 * @example
 * ```typescript
 * const myTask: TaskConfig = {
 *   command: "npm run build",
 *   inputs: ["src/**"],
 *   dependsOn: ["typecheck"],
 * };
 * ```
 *
 * @public
 */
export type {
	CacheConfig,
	LinkctlConfig,
	ResolvedLinkctlConfig,
	Strategy,
	TaskConfig,
} from "./types/index.js";
