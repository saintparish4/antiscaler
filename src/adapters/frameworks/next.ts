import path from "node:path";
import { stat, readFile, readdir } from "node:fs/promises";
import type { FrameworkAdapter } from "../types.js";
import type { BuildPlugin } from "../../core/plugins/types.js";

export const nextAdapter: FrameworkAdapter = {
  name: "next",
  async detect(cwd) {
    const pkgPath = path.join(cwd, "package.json");
    try {
      const json = JSON.parse(await readFile(pkgPath, "utf8")) as Record<
        string,
        unknown
      >;
      const deps = json["dependencies"] as Record<string, unknown> | undefined;
      const devDeps = json["devDependencies"] as
        | Record<string, unknown>
        | undefined;
      const peerDeps = json["peerDependencies"] as
        | Record<string, unknown>
        | undefined;
      return Boolean(deps?.["next"] || devDeps?.["next"] || peerDeps?.["next"]);
    } catch {
      return false;
    }
  },
  devCommand: () => "dev",
  buildCommand: () => "build",
};

export const nextPlugin: BuildPlugin = {
  name: "next",
  hooks: {
    async onDetect(ctx) {
      const apps = await findNextApps(ctx.cwd);
      for (const app of apps) {
        const taskName = `${app}:build`;
        if (!ctx.tasks[taskName]) {
          ctx.tasks[taskName] = {
            command: `pnpm --filter ${app} run build`,
            inputs: [`apps/${app}/**/*.{ts,tsx,js,jsx,json,css}`],
          };
        }
      }
    },
  },
};

async function findNextApps(cwd: string): Promise<string[]> {
  const appsDir = path.join(cwd, "apps");
  try {
    const dirs = await readdir(appsDir, { withFileTypes: true });
    const out: string[] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const cfg = path.join(appsDir, d.name, "next.config.js");
      const cfgMjs = path.join(appsDir, d.name, "next.config.mjs");
      if ((await fileExists(cfg)) || (await fileExists(cfgMjs))) {
        out.push(d.name);
      }
    }
    return out;
  } catch {
    return [];
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
