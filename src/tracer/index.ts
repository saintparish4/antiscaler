/**
 * Build-tool tracer plugins. Part of the supported public API surface
 * (`antiscaler/tracer`); covered by the same semver guarantee as the main
 * entry point as of v1.0.0.
 *
 * @packageDocumentation
 */

/** Next.js / webpack tracer plugin. @public */
export { antiscalerNextPlugin } from "./next-plugin.js";
/** @public */
export type { TraceFile, TraceModule, TracerOptions } from "./types.js";
/** Vite tracer plugin. @public */
export { antiscalerVitePlugin } from "./vite-plugin.js";
/** @public */
export { newSessionId, writeTrace } from "./writer.js";
