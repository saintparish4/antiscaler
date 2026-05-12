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

	it("adding a new exported symbol is breaking", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export const a = 1;",
			after: "export const a = 1;\nexport const b = 2;",
		});
		expect(r.classification).toBe("breaking");
		expect(r.exportedSymbols.added).toContain("b");
	});

	it("removing an exported symbol is breaking", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export const a = 1;\nexport const b = 2;",
			after: "export const a = 1;",
		});
		expect(r.classification).toBe("breaking");
		expect(r.exportedSymbols.removed).toContain("b");
	});

	it("changing an exported type alias is breaking", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export type Foo = { x: number };",
			after: "export type Foo = { x: string };",
		});
		expect(r.classification).toBe("breaking");
		expect(r.exportedSymbols.changed).toContain("Foo");
	});

	it("identical inputs produce non-impacting", () => {
		const code = "export const a = 1;\nfunction internal() { return 2; }";
		const r = classifyChange({
			filePath: "x.ts",
			before: code,
			after: code,
		});
		expect(r.classification).toBe("non-impacting");
	});

	it("whitespace-only change is non-impacting", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export const a = 1;",
			after: "export const a   =   1 ;",
		});
		expect(r.classification).toBe("non-impacting");
	});

	it("changing an exported interface is breaking", () => {
		const r = classifyChange({
			filePath: "x.ts",
			before: "export interface Bar { x: number; }",
			after: "export interface Bar { x: number; y: string; }",
		});
		expect(r.classification).toBe("breaking");
		expect(r.exportedSymbols.changed).toContain("Bar");
	});
});
