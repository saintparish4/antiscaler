import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { FrameworkAdapter } from "../types.js";

export const viteAdapter: FrameworkAdapter = {
	name: "vite",

	detect(cwd: string): boolean {
		const pkgPath = path.join(cwd, "package.json");
		if (!existsSync(pkgPath)) return false;
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
				string,
				unknown
			>;
			const deps = {
				...(pkg["dependencies"] as Record<string, unknown> | undefined),
				...(pkg["devDependencies"] as Record<string, unknown> | undefined),
			};
			return "vite" in deps;
		} catch {
			return false;
		}
	},

	devCommand(): string {
		return "vite";
	},

	buildCommand(): string {
		return "vite build";
	},
};
