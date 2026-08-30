/**
 * Build-tool tracer plugins. Part of the supported public API surface
 * (`linkctl/tracer`); covered by the same semver guarantee as the main
 * entry point as of v1.0.0.
 *
 * @packageDocumentation
 */

/** Next.js / webpack tracer plugin. @public */
export { linkctlNextPlugin } from "./next-plugin.js";
/** @public */
export type { TraceFile, TraceModule, TracerOptions } from "./types.js";
/** Vite tracer plugin. @public */
export { linkctlVitePlugin } from "./vite-plugin.js";
/** @public */
export { newSessionId, writeTrace } from "./writer.js";
