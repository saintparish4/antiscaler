import type { FrameworkAdapter } from "../../adapters/types.js";
import { nextAdapter } from "../../adapters/frameworks/next.js";
import { viteAdapter } from "../../adapters/frameworks/vite.js";
import { genericAdapter } from "../../adapters/frameworks/generic.js";

/** Ordered list of known framework adapters, checked in priority order */
const FRAMEWORK_ADAPTERS: FrameworkAdapter[] = [nextAdapter, viteAdapter];

/**
 * Detects the project framework by inspecting package.json dependencies
 * Returns null when no known framework is found (context.framework will be null)
 * The generic adapter is available seperately for commands that need a fallback
 */
export function detectFramework(cwd: string): FrameworkAdapter | null {
  for (const adapter of FRAMEWORK_ADAPTERS) {
    if (adapter.detect(cwd)) return adapter;
  }
  return null;
}

export { genericAdapter };
