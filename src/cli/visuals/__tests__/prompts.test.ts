import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeGlobalColorChoice } from "../color.js";
import { confirm, input, password } from "../prompts.js";

function fakeOutput(): { chunks: string[]; write: (text: string) => void } {
	const chunks: string[] = [];
	return {
		chunks,
		write: (text: string) => {
			chunks.push(text);
		},
	};
}

beforeEach(() => {
	writeGlobalColorChoice("never");
});

afterEach(() => {
	writeGlobalColorChoice("auto");
});

describe("confirm (line mode, non-TTY)", () => {
	it("accepts y and yes", async () => {
		for (const answer of ["y\n", "yes\n", "Y\n"]) {
			const stdin = new PassThrough();
			const output = fakeOutput();
			const pending = confirm("Proceed?", { input: stdin, output });
			stdin.write(answer);
			await expect(pending).resolves.toBe(true);
			expect(output.chunks.join("")).toContain("Proceed?");
		}
	});

	it("rejects n", async () => {
		const stdin = new PassThrough();
		const pending = confirm("Proceed?", {
			input: stdin,
			output: fakeOutput(),
			defaultValue: true,
		});
		stdin.write("n\n");
		await expect(pending).resolves.toBe(false);
	});

	it("uses the default on an empty answer", async () => {
		const stdin = new PassThrough();
		const pending = confirm("Proceed?", {
			input: stdin,
			output: fakeOutput(),
			defaultValue: true,
		});
		stdin.write("\n");
		await expect(pending).resolves.toBe(true);
	});

	it("uses the default on EOF", async () => {
		const stdin = new PassThrough();
		const pending = confirm("Proceed?", {
			input: stdin,
			output: fakeOutput(),
			defaultValue: true,
		});
		stdin.end();
		await expect(pending).resolves.toBe(true);
	});
});

describe("password (line mode, non-TTY)", () => {
	it("returns the entered line", async () => {
		const stdin = new PassThrough();
		const pending = password("Token", { input: stdin, output: fakeOutput() });
		stdin.write("hunter2\n");
		await expect(pending).resolves.toBe("hunter2");
	});
});

describe("input (line mode, non-TTY)", () => {
	it("returns the entered line and shows the prompt", async () => {
		const stdin = new PassThrough();
		const output = fakeOutput();
		const pending = input("Project name", { input: stdin, output });
		stdin.write("link\n");
		await expect(pending).resolves.toBe("link");
		expect(output.chunks.join("")).toContain("Project name");
	});
});
