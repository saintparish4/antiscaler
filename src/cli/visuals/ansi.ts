/**
 * Raw ANSI escape sequences shared by the visuals layer. Kept in one place so
 * renderers and prompts stay consistent about how they move/clear the cursor.
 */

const ESC = "\u001b";

export const HIDE_CURSOR = `${ESC}[?25l`;
export const SHOW_CURSOR = `${ESC}[?25h`;
export const CLEAR_LINE = `${ESC}[2K`;

/**
 * Synchronized-update guards (DEC 2026): terminals that support them (Windows
 * Terminal, iTerm2, kitty, ...) buffer everything in between and paint it as
 * one atomic frame — no flicker; unsupporting terminals ignore them.
 */
export const SYNC_START = `${ESC}[?2026h`;
export const SYNC_END = `${ESC}[?2026l`;

/** Move the cursor up `lines` rows (empty string for 0). */
export function cursorUp(lines: number): string {
	return lines > 0 ? `${ESC}[${lines}A` : "";
}

const STYLE_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** Strip SGR styling sequences, leaving only printable characters. */
export function stripStyles(text: string): string {
	return text.replace(STYLE_PATTERN, "");
}

/** The on-screen width of a line, ignoring styling sequences. */
export function visibleLength(line: string): number {
	return stripStyles(line).length;
}

/**
 * Truncate a line to the terminal width so soft-wrapped lines don't corrupt
 * in-place repainting. Falls back to the unstyled text when truncation is
 * needed, since slicing mid-escape-sequence would leak garbage.
 */
export function fitWidth(line: string, columns: number): string {
	if (visibleLength(line) <= columns) return line;
	return stripStyles(line).slice(0, Math.max(0, columns - 1));
}
