/**
 * Interactive terminal prompts, ported from uv-console: raw-keystroke
 * `confirm` (no Enter needed), no-echo `password`, and plain `input`.
 *
 * Prompts write to stderr so they compose with piped stdout. On a non-TTY
 * stdin (piped input, CI) every prompt degrades to line-based reading.
 */

import type { Key } from "node:readline";
import { createInterface, emitKeypressEvents } from "node:readline";
import { CLEAR_LINE, HIDE_CURSOR, SHOW_CURSOR } from "./ansi.js";
import { getColors } from "./color.js";

/** Readable side of a prompt; `process.stdin` satisfies this shape. */
export interface PromptInput extends NodeJS.ReadableStream {
	isTTY?: boolean | undefined;
	setRawMode?(mode: boolean): void;
}

/** Writable side of a prompt; `process.stderr` satisfies this shape. */
export interface PromptOutput {
	write(text: string): void;
}

export interface PromptStreams {
	input?: PromptInput;
	output?: PromptOutput;
}

export interface ConfirmOptions extends PromptStreams {
	/** Answer used when the user just presses Enter. Defaults to `false`. */
	defaultValue?: boolean;
}

function readLine(input: PromptInput): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({ input });
		rl.once("line", (line) => {
			// Resolve before close(): readline emits "close" synchronously, and
			// the EOF fallback below would otherwise win the race with "".
			resolve(line);
			rl.close();
		});
		rl.once("close", () => {
			resolve("");
		});
	});
}

function readConfirmKey(
	input: PromptInput,
	output: PromptOutput,
	defaultValue: boolean,
): Promise<boolean> {
	return new Promise((resolve) => {
		emitKeypressEvents(input);
		input.setRawMode?.(true);
		const settle = (response: boolean) => {
			input.setRawMode?.(false);
			input.removeListener("keypress", onKeypress);
			input.pause();
			resolve(response);
		};
		const onKeypress = (_chunk: unknown, key: Key | undefined) => {
			if (key?.ctrl === true && key.name === "c") {
				input.setRawMode?.(false);
				output.write(`${SHOW_CURSOR}\n`);
				process.exit(130);
			}
			if (key?.name === "y") {
				settle(true);
			} else if (key?.name === "n") {
				settle(false);
			} else if (key?.name === "return" || key?.name === "enter") {
				settle(defaultValue);
			}
		};
		input.on("keypress", onKeypress);
	});
}

/**
 * Ask a yes/no question. On a TTY this reads a single `y`/`n`/Enter keystroke
 * (Ctrl+C exits with code 130); otherwise it reads a line, treating an empty
 * answer as the default.
 */
export async function confirm(
	message: string,
	options: ConfirmOptions = {},
): Promise<boolean> {
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stderr;
	const defaultValue = options.defaultValue ?? false;
	const colors = getColors();

	const hint = defaultValue ? "yes" : "no";
	const prompt = `${colors.yellow("?")} ${colors.bold(message)} ${colors.dim("[y/n]")} ${colors.dim("›")} ${colors.cyan(hint)}`;

	if (input.isTTY !== true || input.setRawMode === undefined) {
		output.write(`${prompt} `);
		const answer = (await readLine(input)).trim().toLowerCase();
		if (answer === "") return defaultValue;
		return answer === "y" || answer === "yes";
	}

	output.write(`${prompt}${HIDE_CURSOR}`);
	const response = await readConfirmKey(input, output, defaultValue);
	const report = `${colors.green("✔")} ${colors.bold(message)} ${colors.dim("·")} ${colors.cyan(response ? "yes" : "no")}`;
	output.write(`\r${CLEAR_LINE}${report}${SHOW_CURSOR}\n`);
	return response;
}

function readSecureLine(
	input: PromptInput,
	output: PromptOutput,
): Promise<string> {
	return new Promise((resolve) => {
		emitKeypressEvents(input);
		input.setRawMode?.(true);
		let entered = "";
		const settle = () => {
			input.setRawMode?.(false);
			input.removeListener("keypress", onKeypress);
			input.pause();
			resolve(entered);
		};
		const onKeypress = (chunk: unknown, key: Key | undefined) => {
			if (key?.ctrl === true && key.name === "c") {
				input.setRawMode?.(false);
				output.write("\n");
				process.exit(130);
			}
			if (key?.name === "return" || key?.name === "enter") {
				settle();
				return;
			}
			if (key?.name === "backspace") {
				entered = entered.slice(0, -1);
				return;
			}
			if (typeof chunk === "string" && key?.ctrl !== true) entered += chunk;
		};
		input.on("keypress", onKeypress);
	});
}

/** Read a secret without echoing it. Falls back to line reading off a TTY. */
export async function password(
	message: string,
	options: PromptStreams = {},
): Promise<string> {
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stderr;
	const colors = getColors();

	output.write(
		`${colors.yellow("?")} ${colors.bold(message)} ${colors.dim("›")} `,
	);

	if (input.isTTY !== true || input.setRawMode === undefined) {
		return await readLine(input);
	}

	const secret = await readSecureLine(input, output);
	output.write(`\r${CLEAR_LINE}`);
	return secret;
}

/** Ask for a free-form line of input (echoed as the user types). */
export async function input(
	message: string,
	options: PromptStreams = {},
): Promise<string> {
	const promptInput = options.input ?? process.stdin;
	const output = options.output ?? process.stderr;
	const colors = getColors();

	output.write(
		`${colors.yellow("?")} ${colors.bold(message)} ${colors.dim("›")} `,
	);
	return await readLine(promptInput);
}
