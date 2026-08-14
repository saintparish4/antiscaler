/**
 * @module
 * The one way `cli/render` reaches the terminal. Renderers write through a
 * {@link Printer} rather than `console.log` so `-q`/`-qq`/`-v` gate every
 * command's output uniformly — bypassing it silently breaks those flags.
 */

import type { Printer } from "../visuals/printer.js";

/** Write newline-terminated lines to stdout. */
export function lines(printer: Printer, ...text: readonly string[]): void {
	for (const t of text) printer.stdout(`${t}\n`);
}

/** Write newline-terminated lines to stderr, for diagnostics and warnings. */
export function errorLines(printer: Printer, ...text: readonly string[]): void {
	for (const t of text) printer.stderr(`${t}\n`);
}
