import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LinkConfig, ResolvedLinkConfig } from "../../types/index.js";
import { ConfigError } from "../errors.js";
import { linkConfigSchema } from "./schema.js";

export function defineConfig(config: LinkConfig): LinkConfig {
	return config;
}

const CANDIDATES = [
	"link.config.ts",
	"link.config.mjs",
	"link.config.js",
	"buildflow.config.json",
	"link.config.json",
] as const;

/** First matching config path under `cwd`, in the same order as `loadConfig` resolution. */
export function findLinkConfigPath(cwd: string): string | undefined {
	return CANDIDATES.map((f) => path.join(cwd, f)).find(existsSync);
}

export async function loadConfig(
	cwd: string = process.cwd(),
): Promise<ResolvedLinkConfig> {
	const configPath = findLinkConfigPath(cwd);

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
			// needs no build step before link can read it.
			const { createJiti } = await import("jiti");
			const jiti = createJiti(import.meta.url);
			const mod = await jiti.import(configPath);
			raw = (mod as { default?: unknown }).default ?? mod;
		}
	}

	const result = linkConfigSchema.safeParse(raw);

	if (!result.success) {
		const messages = result.error.issues
			.map((e) => ` ${e.path.map(String).join(".")}: ${e.message}`)
			.join("\n");
		throw new ConfigError(`Invalid link config:\n${messages}`);
	}

	return result.data as ResolvedLinkConfig;
}
