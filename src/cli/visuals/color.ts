import pc from "picocolors";

/** The picocolors palette shape — every formatter no-ops when disabled. */
export type Colors = ReturnType<typeof pc.createColors>;

export type ColorChoice = "auto" | "always" | "never";

export interface ColorFlags {
	/**
	 * Value of `--color <when>`. Commander sets `false` when `--no-color` is
	 * passed (negated option sharing the same key).
	 */
	color?: string | boolean | undefined;
}

function envFlagSet(name: string): boolean {
	const value = process.env[name];
	return value !== undefined && value !== "";
}

/**
 * Resolve the effective color choice from flags and environment variables, in
 * priority order: `--color` > `--no-color` > `NO_COLOR` >
 * `FORCE_COLOR`/`CLICOLOR_FORCE` > terminal auto-detection.
 */
export function resolveColorChoice(flags: ColorFlags = {}): ColorChoice {
	const { color } = flags;
	if (color === "auto" || color === "always" || color === "never") return color;
	if (color === false) return "never";
	if (envFlagSet("NO_COLOR")) return "never";
	if (envFlagSet("FORCE_COLOR") || envFlagSet("CLICOLOR_FORCE")) {
		return "always";
	}
	return "auto";
}

let globalColors: Colors = pc;

/**
 * Apply a {@link ColorChoice} process-wide, once at startup — every later
 * {@link getColors} call reflects it. Mirrors anstream's
 * `ColorChoice::write_global` so color never has to be threaded through call
 * sites.
 */
export function writeGlobalColorChoice(choice: ColorChoice): void {
	globalColors =
		choice === "auto"
			? pc.createColors(pc.isColorSupported)
			: pc.createColors(choice === "always");
}

/** The process-wide palette; styling silently no-ops when colors are off. */
export function getColors(): Colors {
	return globalColors;
}
