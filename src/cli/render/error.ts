import type { AntiscaleError } from "../../core/errors.js";
import { getColors } from "../visuals/color.js";

/** A sink for text; `process.stderr.write` satisfies it. */
export type WriteText = (text: string) => void;

const writeStderr: WriteText = (text) => {
	process.stderr.write(text);
};

/**
 * Renders a fatal error for the CLI top level.
 *
 * Deliberately bypasses the {@link Printer}: `-q`/`-qq` suppress progress and
 * results, not the reason the process is about to exit non-zero.
 */
export function renderError(
	err: AntiscaleError,
	write: WriteText = writeStderr,
): void {
	const colors = getColors();
	write(`${colors.red(`[${err.code}]`)} ${err.message}\n`);
	if (err.hint) write(`${colors.dim(`  Hint: ${err.hint}`)}\n`);
}

/** Renders an error that escaped every typed-error path — always a bug. */
export function renderUnexpectedError(
	err: unknown,
	write: WriteText = writeStderr,
): void {
	const detail =
		err instanceof Error ? (err.stack ?? err.message) : String(err);
	write(`Unexpected error — please file a bug:\n${detail}\n`);
}
