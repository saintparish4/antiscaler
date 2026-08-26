/**
 * @module
 * Public types for the link runtime tracer. Consumed by user webpack /
 *  vite configs and by `link build --scope=<session>` on the CLI side
 */

export interface TraceModule {
	/** Absolute or workspace-relative file path  */
	file: string;
	/** Package this module belongs to (resolved via PackageGraph) */
	package?: string;
	/** Optional first-load route */
	route?: string;
}

export interface TraceFile {
	schemaVersion: 1;
	sessionId: string;
	startedAt: number;
	endedAt: number;
	framework: "next" | "vite" | "unknown";
	modules: TraceModule[];
	routes: Array<{ path: string; modules: string[] }>;
}

export interface TracerOptions {
	/** Output directory. Defaults to `.link/traces`. */
	outDir?: string;
	/** Pre-set sessionId; otherwise generated. */
	sessionId?: string;
}
