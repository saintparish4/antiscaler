import { describe, expect, it } from "vitest";
import { CliUsageError } from "../../core/errors.js";
import { parseConcurrency } from "../parse-opts.js";

describe("parseConcurrency", () => {
	it("returns undefined when concurrency is not set", () => {
		expect(parseConcurrency({})).toBeUndefined();
	});

	it("parses a valid positive integer", () => {
		expect(parseConcurrency({ concurrency: "4" })).toBe(4);
		expect(parseConcurrency({ concurrency: "1" })).toBe(1);
	});

	it("throws CliUsageError for zero", () => {
		expect(() => parseConcurrency({ concurrency: "0" })).toThrow(CliUsageError);
	});

	it("throws CliUsageError for a negative number", () => {
		expect(() => parseConcurrency({ concurrency: "-1" })).toThrow(
			CliUsageError,
		);
	});

	it("throws CliUsageError for a non-numeric string", () => {
		expect(() => parseConcurrency({ concurrency: "abc" })).toThrow(
			CliUsageError,
		);
	});

	it("throws CliUsageError for a float string", () => {
		expect(() => parseConcurrency({ concurrency: "1.5" })).toThrow(
			CliUsageError,
		);
	});

	it("error message includes the bad value", () => {
		expect(() => parseConcurrency({ concurrency: "bad" })).toThrow('"bad"');
	});
});
