import { describe, expect, it } from "vitest";
import type { ClassifyResult } from "../../semantic/differ.js";
import type { BuildVerdict } from "../../semantic/verdict.js";
import type { PrCheckResult } from "../check.js";
import type { PrReplayResult } from "../replay.js";
import type { PrReportResult } from "../report.js";
import { formatPrReportJson, formatPrReportMarkdown } from "../report.js";

function classified(
	filePath: string,
	classification: ClassifyResult["classification"],
	symbols: Partial<ClassifyResult["exportedSymbols"]> = {},
): ClassifyResult {
	return {
		filePath,
		classification,
		exportedSymbols: {
			added: [],
			removed: [],
			changed: [],
			...symbols,
		},
		confidence: 1,
		confidenceNotes: [],
	};
}

function report(
	overrides: {
		verdict?: BuildVerdict;
		files?: ClassifyResult[];
		replay?: PrReplayResult | null;
	} = {},
): PrReportResult {
	const files = overrides.files ?? [];
	const check: PrCheckResult = {
		baseRef: "main",
		tsFilesChanged: files.length,
		files,
		verdict: overrides.verdict ?? "safe-to-skip",
	};
	return {
		generatedAt: "2026-01-01T00:00:00.000Z",
		check,
		replay: overrides.replay ?? null,
	};
}

const replayResult = (
	overrides: Partial<PrReplayResult> = {},
): PrReplayResult => ({
	baseRef: "main",
	sessionId: "sess-1",
	framework: "next",
	changedFiles: [],
	touchedModules: [],
	touchedRoutes: [],
	touchedPackages: [],
	...overrides,
});

describe("formatPrReportJson", () => {
	it("round-trips through JSON.parse", () => {
		const parsed = JSON.parse(formatPrReportJson(report())) as PrReportResult;

		expect(parsed.check.baseRef).toBe("main");
		expect(parsed.replay).toBeNull();
	});
});

describe("formatPrReportMarkdown", () => {
	it("headlines the verdict with its badge", () => {
		expect(
			formatPrReportMarkdown(report({ verdict: "build-required" })),
		).toContain("🔴 **Build required**");
		expect(
			formatPrReportMarkdown(report({ verdict: "build-recommended" })),
		).toContain("⚠️ **Build recommended**");
		expect(
			formatPrReportMarkdown(report({ verdict: "safe-to-skip" })),
		).toContain("✅ **Safe to skip build**");
	});

	it("says so plainly when no TypeScript changed", () => {
		expect(formatPrReportMarkdown(report())).toContain(
			"_No TypeScript files changed._",
		);
	});

	it("tabulates each changed file with its symbol delta", () => {
		const markdown = formatPrReportMarkdown(
			report({
				files: [
					classified("src/api.ts", "breaking", {
						added: ["a"],
						removed: ["b", "c"],
						changed: [{ name: "d", kind: "signature" }],
					}),
				],
			}),
		);

		expect(markdown).toContain("| File | Classification | API Changes |");
		expect(markdown).toContain("| `src/api.ts` | breaking | +1 -2 ~1 |");
	});

	it("writes an em dash when a file changed with no symbol delta", () => {
		const markdown = formatPrReportMarkdown(
			report({ files: [classified("src/impl.ts", "internal")] }),
		);

		expect(markdown).toContain("| `src/impl.ts` | internal | — |");
	});

	it("notes the absence of a trace session", () => {
		expect(formatPrReportMarkdown(report())).toContain(
			"_No trace session available._",
		);
	});

	it("lists touched routes and packages from a replay", () => {
		const markdown = formatPrReportMarkdown(
			report({
				replay: replayResult({
					touchedRoutes: [{ path: "/checkout", modules: ["a.ts"] }],
					touchedPackages: ["web", "utils"],
				}),
			}),
		);

		expect(markdown).toContain("**Touched routes (1):**");
		expect(markdown).toContain("- `/checkout`");
		expect(markdown).toContain("**Touched packages:** `web`, `utils`");
	});

	it("says no routes were touched when a session exists but matched nothing", () => {
		const markdown = formatPrReportMarkdown(report({ replay: replayResult() }));

		expect(markdown).toContain("_No traced routes are touched by this PR._");
	});
});
