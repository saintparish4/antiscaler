import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
	LinkctlConfig,
	ResolvedLinkctlConfig,
} from "../../types/index.js";
import { ConfigError } from "../errors.js";
import { linkctlConfigSchema } from "./schema.js";

export function defineConfig(config: LinkctlConfig): LinkctlConfig {
	return config;
}

const CANDIDATES = [
	"linkctl.config.ts",
	"linkctl.config.mjs",
	"linkctl.config.js",
	"linkctl.config.json",
] as const;

/** First matching config path under `cwd`, in the same order as `loadConfig` resolution. */
export function findLinkctlConfigPath(cwd: string): string | undefined {
	return CANDIDATES.map((f) => path.join(cwd, f)).find(existsSync);
}

export async function loadConfig(
	cwd: string = process.cwd(),
): Promise<ResolvedLinkctlConfig> {
	const configPath = findLinkctlConfigPath(cwd);

	let raw: unknown = {};

	if (configPath) {
		if (path.extname(configPath) === ".json") {
			try {
				const text = await readFile(configPath, "utf8");
				raw = JSON.parse(text) as unknown;
			} catch (err) {
				const hint = err instanceof Error ? err.message : String(err);
				throw new ConfigError(
					`Invalid JSON config (${path.basename(configPath)}): ${hint}`,
				);
			}
		} else {
			// jiti transpiles TS and resolves ESM on the fly, so a .ts config
			// needs no build step before linkctl can read it.
			const { createJiti } = await import("jiti");
			const jiti = createJiti(import.meta.url);
			const mod = await jiti.import(configPath);
			raw = (mod as { default?: unknown }).default ?? mod;
		}
	}

	const result = linkctlConfigSchema.safeParse(raw);

	if (!result.success) {
		const messages = result.error.issues
			.map((e) => ` ${e.path.map(String).join(".")}: ${e.message}`)
			.join("\n");
		throw new ConfigError(`Invalid linkctl config:\n${messages}`);
	}

	return result.data as ResolvedLinkctlConfig;
}
