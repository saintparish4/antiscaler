/**
 * @module
 * Workspace package discovery + package-level DAG. Reads pnpm-workspace.yaml,
 * package.json `workspaces`, and tsconfig project references; produces a
 * deterministic list of WorkspacePackages and a coarse package-level DAG that
 * drives auto-generated TaskGraph entries.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { TaskConfig } from "../../types/index.js";

export interface WorkspacePackage {
  name: string;
  /** Absolute path to the package directory */
  dir: string;
  /** Parsed package.json contents  (subset we care about) */
  manifest: {
    name: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
}

export interface PackageGraph {
  packages: ReadonlyArray<WorkspacePackage>;
  /** package name -> set of workspace package names it depends on */
  edges: ReadonlyMap<string, ReadonlySet<string>>;
}

const WORKSPACE_GLOBS_FALLBACK = ["packages/*", "apps/*", "services/*"];

export async function loadPackageGraph(cwd: string): Promise<PackageGraph> {
  const globs = await readWorkspaceGlobs(cwd);
  const dirs = await fg(globs, {
    cwd,
    onlyDirectories: true,
    absolute: true,
  });

  const packages: WorkspacePackage[] = [];
  for (const dir of dirs.sort()) {
    const pkg = await readPackage(dir);
    if (pkg) packages.push(pkg);
  }

  const byName = new Map(packages.map((p) => [p.manifest.name, p]));
  const edges = new Map<string, Set<string>>();
  for (const p of packages) {
    const set = new Set<string>();
    const all = {
      ...(p.manifest.dependencies ?? {}),
      ...(p.manifest.devDependencies ?? {}),
      ...(p.manifest.peerDependencies ?? {}),
    };
    for (const dep of Object.keys(all)) {
      if (byName.has(dep)) set.add(dep);
    }
    edges.set(p.manifest.name, set);
  }

  return { packages, edges };
}

/**
 * Auto-generate TaskConfig entries from package scripts. Naming convention:
 *   <package-name>:<script-name>
 * Existing user-defined tasks always win; we only fill gaps.
 */

export function tasksFromPackageGraph(
  graph: PackageGraph,
  existing: Record<string, TaskConfig>,
  scripts: ReadonlyArray<string> = ["build", "test", "lint"],
): Record<string, TaskConfig> {
  const out: Record<string, TaskConfig> = { ...existing };
  for (const pkg of graph.packages) {
    const pkgScripts = pkg.manifest.scripts ?? {};
    for (const script of scripts) {
      if (!pkgScripts[script]) continue;
      const taskName = `${pkg.manifest.name}:${script}`;
      if (out[taskName]) continue;
      const dependsOn: string[] = [];
      for (const upstream of graph.edges.get(pkg.manifest.name) ?? []) {
        if ((scripts as readonly string[]).includes(script)) {
          dependsOn.push(`${upstream}:${script}`);
        }
      }
      out[taskName] = {
        command: `pnpm --filter ${pkg.manifest.name} run ${script}`,
        dependsOn,
        inputs: [
          path.posix.join(
            path.relative(process.cwd(), pkg.dir).replace(/\\/g, "/"),
            "**/*.{ts,tsx,js,jsx,json}",
          ),
        ],
      };
    }
  }
  return out;
}

async function readWorkspaceGlobs(cwd: string): Promise<string[]> {
  const pnpm = path.join(cwd, "pnpm-workspace.yaml");
  if (await fileExists(pnpm)) {
    const text = await readFile(pnpm, "utf8");
    const lines = text.split("\n");
    const globs: string[] = [];
    let inPackages = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("packages:")) {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        const m = /^-\s*['"]?([^'"\s]+)['"]?/.exec(t);
        if (m) globs.push(m[1]!);
        else if (t && !t.startsWith("#")) inPackages = false;
      }
    }
    if (globs.length) return globs;
  }
  const root = path.join(cwd, "package.json");
  if (await fileExists(root)) {
    const json = JSON.parse(await readFile(root, "utf8")) as {
      workspaces?: string[] | { packages?: string[] };
    };
    const ws = Array.isArray(json.workspaces)
      ? json.workspaces
      : json.workspaces?.packages;
    if (ws?.length) return ws;
  }
  return WORKSPACE_GLOBS_FALLBACK;
}

async function readPackage(dir: string): Promise<WorkspacePackage | null> {
  const manifestPath = path.join(dir, "package.json");
  if (!(await fileExists(manifestPath))) return null;
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!manifest?.name) return null;
    return { name: manifest.name, dir, manifest };
  } catch {
    return null;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
