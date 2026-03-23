import path from "path";
import { existsSync } from "fs";
import type {
  AntiscaleConfig,
  ResolvedAntiscaleConfig,
} from "../../types/index.js";
import { ConfigError } from "../errors.js";
import { antiscaleConfigSchema } from "./schema.js";

export function defineConfig(config: AntiscaleConfig): AntiscaleConfig {
  return config;
}

const CONFIG_FILENAMES = [
  "antiscale.config.ts",
  "antiscale.config.js",
  "antiscale.config.mjs",
];

export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<ResolvedAntiscaleConfig> {
  // 1. Find config file
  const configPath = CONFIG_FILENAMES.map((f) => path.join(cwd, f)).find(
    existsSync,
  );

  let raw: unknown = {};

  if (configPath) {
    // 2. Use jiti for TypeScript/ESM support (lazy import)
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url);
    const mod = await jiti.import(configPath);
    raw = (mod as { default?: unknown }).default ?? mod;
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
