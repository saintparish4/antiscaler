import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, LinkError } from "../../../core/errors.js";
import { writeGlobalColorChoice } from "../../visuals/color.js";
import { renderError, renderUnexpectedError } from "../error.js";

function capture(): { write: (text: string) => void; text: () => string } {
	let out = "";
	return {
		write: (text) => {
			out += text;
		},
		text: () => out,
	};
}

beforeEach(() => {
	writeGlobalColorChoice("never");
});

describe("renderError", () => {
	it("leads with the machine-readable code, then the message", () => {
		const sink = capture();

		renderError(new LinkError("MY_CODE", "something went wrong"), sink.write);

		expect(sink.text()).toContain("[MY_CODE]");
		expect(sink.text()).toContain("something went wrong");
	});

	it("prints the hint when the error carries one", () => {
		const sink = capture();

		renderError(new ConfigError("bad config"), sink.write);

		expect(sink.text()).toContain("[CONFIG_ERROR]");
		expect(sink.text()).toContain("Hint:");
		expect(sink.text()).toContain("link doctor");
	});

	it("omits the hint line when there is no hint", () => {
		const sink = capture();

		renderError(new LinkError("BARE", "no hint here"), sink.write);

		expect(sink.text()).not.toContain("Hint:");
	});
});

describe("renderUnexpectedError", () => {
	it("asks for a bug report and includes the stack", () => {
		const sink = capture();

		renderUnexpectedError(new Error("boom"), sink.write);

		expect(sink.text()).toContain("please file a bug");
		expect(sink.text()).toContain("boom");
	});

	it("stringifies a thrown non-Error value", () => {
		const sink = capture();

		renderUnexpectedError("just a string", sink.write);

		expect(sink.text()).toContain("just a string");
	});
});
