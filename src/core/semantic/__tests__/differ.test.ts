import { describe, expect, it } from "vitest";
import { classifyChange } from "../differ.js";

describe("classifyChange", () => {
	it("flags comment-only edits as non-impacting", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export const a = 1;\n// hello",
			after: "export const a = 1;\n// goodbye",
		});
		expect(r.classification).toBe("non-impacting");
	});

	it("flags non-exported body changes as internal", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "function f() { return 1; }\nexport const a = 1;",
			after: "function f() { return 2; }\nexport const a = 1;",
		});
		expect(r.classification).toBe("internal");
	});

	it("flags exported signature changes as breaking", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export function add(a: number, b: number) { return a+b; }",
			after: "export function add(a: number) { return a; }",
		});
		expect(r.classification).toBe("breaking");
		expect(r.exportedSymbols.changed).toContain("add");
	});
});
