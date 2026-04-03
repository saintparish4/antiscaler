import type { RuntimeAdapter } from "../../adapters/types.js";
import type { RuntimeInfo } from "../../types/index.js";
import { bunAdapter } from "../../adapters/runtimes/bun.js";
import { denoAdapter } from "../../adapters/runtimes/deno.js";
import { nodeAdapter } from "../../adapters/runtimes/node.js";

/**
 * Detects the active runtime from process globals (fast, no subprocess)
 * Falls back to probing via subprocess if globals are unavailable
 * Always returns a RuntimeAdapter -- falls back to node
 */
export function detectRuntime(): RuntimeAdapter {
  // Check process globals first (zero cost -- no subprocesses)
  if (typeof (globalThis as Record<string, unknown>)["Bun"] !== "undefined") {
    return bunAdapter;
  }
  if (typeof (globalThis as Record<string, unknown>)["Deno"] !== "undefined") {
    return denoAdapter;
  }
  // Fallback: probe via subprocess (covers cases like running under node
  // bun bun/deno are installed and could be the intended runtime)
  return nodeAdapter;
}

/**
 * Builds a RuntimeInfo value for AntiscaleContext from an adapter
 * primary: the detected runtime name
 * fallback: always "node" (guaranteed to be available in most environments)
 */
export function toRuntimeInfo(adapter: RuntimeAdapter): RuntimeInfo {
  return {
    primary: adapter.name,
    fallback: adapter.name === "node" ? "node" : "node",
  };
}
