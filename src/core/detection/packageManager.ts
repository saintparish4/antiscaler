import { existsSync } from "node:fs";
import path from "node:path";
import { npmAdapter } from "../../adapters/pm/npm.js";
import { pnpmAdapter } from "../../adapters/pm/pnpm.js";
import { yarnAdapter } from "../../adapters/pm/yarn.js";
import type { PackageManagerAdapter } from "../../adapters/types.js";

/**
 * Detects the package manager by checking for well-known lockfiles and
 * workspace config files.
 * Priority: pnpm > yarn > npm (most specific to least specific)
 * Always returns an adapter -- falls back to npm
 */
export function detectPackageManager(cwd: string): PackageManagerAdapter {
	if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return pnpmAdapter;
	if (existsSync(path.join(cwd, "pnpm-workspace.yaml"))) return pnpmAdapter;
	if (existsSync(path.join(cwd, "yarn.lock"))) return yarnAdapter;
	if (existsSync(path.join(cwd, "package-lock.json"))) return npmAdapter;
	return npmAdapter; // fallback
}
