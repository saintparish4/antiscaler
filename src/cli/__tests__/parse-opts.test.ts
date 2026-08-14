import { describe, expect, it } from "vitest";
import { CliUsageError } from "../../core/errors.js";
import { parseConcurrency } from "../parse-opts.js";

describe("parseConcurrency", () => {
	it("returns undefined when the flag was not passed", () => {
		expect(parseConcurrency({})).toBeUndefined();
	});

	it("parses a positive integer", () => {
		expect(parseConcurrency({ concurrency: "4" })).toBe(4);
	});

	it("tolerates surrounding whitespace", () => {
		expect(parseConcurrency({ concurrency: " 8 " })).toBe(8);
	});

	it("rejects zero and negatives, which would stall the runner", () => {
		expect(() => parseConcurrency({ concurrency: "0" })).toThrow(CliUsageError);
		expect(() => parseConcurrency({ concurrency: "-1" })).toThrow(
			CliUsageError,
		);
	});

	it("rejects a non-numeric value", () => {
		expect(() => parseConcurrency({ concurrency: "many" })).toThrow(
			CliUsageError,
		);
	});

	// "4x" parses as 4 under parseInt; accepting it would silently ignore the
	// rest of what the user typed.
	it("rejects a value with trailing junk rather than truncating it", () => {
		expect(() => parseConcurrency({ concurrency: "4x" })).toThrow(
			CliUsageError,
		);
	});

	it("rejects a fractional value", () => {
		expect(() => parseConcurrency({ concurrency: "2.5" })).toThrow(
			CliUsageError,
		);
	});

	it("names the offending value in the error", () => {
		expect(() => parseConcurrency({ concurrency: "nope" })).toThrow(/"nope"/);
	});
});
