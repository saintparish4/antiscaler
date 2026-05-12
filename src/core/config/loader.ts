import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
	AntiscaleConfig,
	ResolvedAntiscaleConfig,
} from "../../types/index.js";
import { ConfigError } from "../errors.js";
import { antiscaleConfigSchema } from "./schema.js";

export function defineConfig(config: AntiscaleConfig): AntiscaleConfig {
	return config;
}

const CANDIDATES = [
	"antiscale.config.ts",
	"antiscale.config.mjs",
	"antiscale.config.js",
	"buildflow.config.json",
	"antiscale.config.json",
] as const;

/** First matching config path under `cwd`, in the same order as `loadConfig` resolution. */
export function findAntiscaleConfigPath(cwd: string): string | undefined {
	return CANDIDATES.map((f) => path.join(cwd, f)).find(existsSync);
}

export async function loadConfig(
	cwd: string = process.cwd(),
): Promise<ResolvedAntiscaleConfig> {
	const configPath = findAntiscaleConfigPath(cwd);

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
			// TypeScript / JS / MJS: jiti for TS + ESM
			const { createJiti } = await import("jiti");
			const jiti = createJiti(import.meta.url);
			const mod = await jiti.import(configPath);
			raw = (mod as { default?: unknown }).default ?? mod;
		}
	}

	// 3. Parse through Zod schema (applies defaults, validates)
	const result = antiscaleConfigSchema.safeParse(raw);

	if (!result.success) {
		const messages = result.error.issues
			.map((e) => ` ${e.path.map(String).join(".")}: ${e.message}`)
			.join("\n");
		throw new ConfigError(`Invalid antiscale config:\n${messages}`);
	}

	return result.data as ResolvedAntiscaleConfig;
}
