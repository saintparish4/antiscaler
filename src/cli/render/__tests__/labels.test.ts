import { describe, expect, it } from "vitest";
import { classificationLabel, plural } from "../labels.js";

describe("classificationLabel", () => {
	it("pads every classification to the same width so columns align", () => {
		const widths = (
			["non-impacting", "internal", "breaking", "unanalyzed"] as const
		).map((c) => classificationLabel(c).length);

		expect(new Set(widths).size).toBe(1);
	});

	it("keeps the classification readable inside the padding", () => {
		expect(classificationLabel("breaking").trim()).toBe("breaking");
	});
});

describe("plural", () => {
	it("uses the singular for exactly one", () => {
		expect(plural(1, "file")).toBe("1 file");
	});

	it("uses the plural for zero and for many", () => {
		expect(plural(0, "file")).toBe("0 files");
		expect(plural(2, "file")).toBe("2 files");
	});

	it("groups digits so large counts stay readable", () => {
		expect(plural(2048, "file")).toBe("2,048 files");
	});
});
