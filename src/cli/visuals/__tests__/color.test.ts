import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getColors,
	resolveColorChoice,
	writeGlobalColorChoice,
} from "../color.js";

const ESC = String.fromCharCode(27);

describe("resolveColorChoice", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("defaults to auto with no flags or env", () => {
		expect(resolveColorChoice({})).toBe("auto");
	});

	it("prefers the --color flag over env variables", () => {
		vi.stubEnv("NO_COLOR", "1");
		expect(resolveColorChoice({ color: "always" })).toBe("always");
	});

	it("treats --no-color (color: false) as never, over FORCE_COLOR", () => {
		vi.stubEnv("FORCE_COLOR", "1");
		expect(resolveColorChoice({ color: false })).toBe("never");
	});

	it("respects NO_COLOR over FORCE_COLOR", () => {
		vi.stubEnv("NO_COLOR", "1");
		vi.stubEnv("FORCE_COLOR", "1");
		expect(resolveColorChoice({})).toBe("never");
	});

	it("respects FORCE_COLOR", () => {
		vi.stubEnv("FORCE_COLOR", "1");
		expect(resolveColorChoice({})).toBe("always");
	});

	it("respects CLICOLOR_FORCE", () => {
		vi.stubEnv("CLICOLOR_FORCE", "1");
		expect(resolveColorChoice({})).toBe("always");
	});

	it("ignores empty env values", () => {
		vi.stubEnv("NO_COLOR", "");
		expect(resolveColorChoice({})).toBe("auto");
	});
});

describe("writeGlobalColorChoice", () => {
	afterEach(() => {
		writeGlobalColorChoice("auto");
	});

	it("enables styling globally for always", () => {
		writeGlobalColorChoice("always");
		expect(getColors().green("x")).toContain(ESC);
	});

	it("disables styling globally for never", () => {
		writeGlobalColorChoice("never");
		expect(getColors().green("x")).toBe("x");
	});
});
