import { describe, expect, it } from "vitest";
import { cursorUp, fitWidth, stripStyles, visibleLength } from "../ansi.js";

const ESC = String.fromCharCode(27);
const styled = `${ESC}[1m${ESC}[32mdone${ESC}[39m${ESC}[22m`;

describe("cursorUp", () => {
	it("returns an empty string for zero lines", () => {
		expect(cursorUp(0)).toBe("");
	});

	it("moves up the given number of lines", () => {
		expect(cursorUp(3)).toBe(`${ESC}[3A`);
	});
});

describe("stripStyles / visibleLength", () => {
	it("removes SGR sequences", () => {
		expect(stripStyles(styled)).toBe("done");
	});

	it("measures only printable characters", () => {
		expect(visibleLength(styled)).toBe(4);
	});
});

describe("fitWidth", () => {
	it("keeps lines that fit, styles included", () => {
		expect(fitWidth(styled, 10)).toBe(styled);
	});

	it("truncates over-wide lines to unstyled text", () => {
		expect(fitWidth("abcdefghij", 5)).toBe("abcd");
	});
});
