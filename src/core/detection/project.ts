import type {
  PackageManagerAdapter,
  RuntimeAdapter,
  FrameworkAdapter,
} from "../../adapters/types.js";
import { detectPackageManager } from "./packageManager.js";
import { detectRuntime } from "./runtime.js";
import { detectFramework } from "./framework.js";

export interface DetectedProject {
  pm: PackageManagerAdapter;
  runtime: RuntimeAdapter;
  /** null when no known framework is detected */
  framework: FrameworkAdapter | null;
}

/**
 * Runs all detectors in one call. Use this in createContext() and the env command
 * Individual detectors are also exported for targeted use
 */
export async function detectProject(cwd: string): Promise<DetectedProject> {
  return {
    pm: detectPackageManager(cwd),
    runtime: detectRuntime(),
    framework: await detectFramework(cwd),
  };
}
