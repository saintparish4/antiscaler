/**
 * @module
 * `antiscaler impact` (roadmap 1.5) — the headline command. Predicts which
 * tests a change requires by running the full Pillar 1 pipeline (signature
 * differ → blast radius → test impact) and emits the run/skip block.
 *
 * REPORT-ONLY by design: skipping is not enabled here. Every run logs its
 * prediction to `.antiscale/history/impact.jsonl`; the measured false-skip
 * rate over shadow runs is what will earn the right to skip (the hard gate),
 * so the printed confidence is a graph-resolution score, not a promise.
 */

import type { TraceBlastRadiusOptions } from "../../core/semantic/blast-radius.js";
import type { TestImpactResult } from "../../core/semantic/test-impact.js";
import type { PrVerdict } from "./pr.js";

export interface ImpactOptions {
	/** Git ref to compare against. Defaults to HEAD~1. */
	base?: string;
	/** Print the report as JSON instead of the human block. */
	json?: boolean;
	/** DI for tests: skip git and use these changed files. */
	changedFiles?: string[];
	/** DI for tests: content of a file at baseRef. */
	readBefore?: TraceBlastRadiusOptions["readBefore"];
}

export interface ImpactReport {
	baseRef: string;
	result: TestImpactResult;
	verdict: PrVerdict;
	historyLogged: boolean;
}

/** Testable core: trace, decide the verdict, log the shadow prediction. */
export async function runImpact(
	cwd: string,
	opts: ImpactOptions = {},
): Promise<ImpactReport | null> {
	const { traceTestImpact } = await import(
		"../../core/semantic/test-impact.js"
	);
	const { loadPackageGraph } = await import(
		"../../core/graph/package-graph.js"
	);

	const baseRef = opts.base ?? "HEAD~1";
	const packageGraph = await loadPackageGraph(cwd).catch(() => undefined);

	const result = await traceTestImpact(cwd, {
		baseRef,
		...(packageGraph !== undefined && { packageGraph }),
		...(opts.changedFiles !== undefined && {
			changedFiles: opts.changedFiles,
		}),
		...(opts.readBefore !== undefined && { readBefore: opts.readBefore }),
	});
	if (result === null) return null;

	// Same vocabulary as `pr check`. A config-driven select-all is as strong a
	// signal as a breaking API change.
	let verdict: PrVerdict = "safe-to-skip";
	if (
		result.tests.selectAll ||
		result.radius.changed.some((c) => c.classification === "breaking")
	) {
		verdict = "build-required";
	} else if (
		result.radius.changed.some(
			(c) =>
				c.classification === "internal" || c.classification === "unanalyzed",
		)
	) {
		verdict = "build-recommended";
	}

	const { appendImpactPrediction, defaultHistoryDir } = await import(
		"../../core/history/impact-log.js"
	);
	const historyLogged = await appendImpactPrediction(defaultHistoryDir(cwd), {
		at: new Date().toISOString(),
		baseRef,
		changedFiles: result.radius.changed.map((c) => c.filePath),
		affectedFiles: result.radius.affectedFiles.length,
		affectedPackages: result.radius.affectedPackages,
		affectedTests: result.tests.affectedTests,
		totalTests: result.tests.totalTests,
		selectAll: result.tests.selectAll,
		verdict,
		confidence: result.tests.confidence,
		notes: [...result.radius.notes, ...result.tests.notes],
	});

	return { baseRef, result, verdict, historyLogged };
}

export async function registerImpactAction(
	opts: ImpactOptions = {},
): Promise<void> {
	const cwd = process.cwd();
	const report = await runImpact(cwd, opts);

	if (report === null) {
		console.log(
			"impact: could not determine changed files (is this a git repository with at least one prior commit?). Pass --base <ref> against a valid ref.",
		);
		return;
	}

	if (opts.json === true) {
		const { result, ...rest } = report;
		console.log(
			JSON.stringify(
				{ ...rest, radius: result.radius, tests: result.tests },
				null,
				2,
			),
		);
		return;
	}

	const { radius, tests } = report.result;
	const n = (v: number): string => v.toLocaleString("en-US");
	const classLabels: Record<string, string> = {
		"non-impacting": "non-impacting",
		internal: "internal     ",
		breaking: "breaking     ",
		unanalyzed: "unanalyzed   ",
	};
	const verdictText: Record<PrVerdict, string> = {
		"safe-to-skip": "safe to skip build",
		"build-recommended": "build recommended",
		"build-required": "build required",
	};

	console.log(`\nBase ref: ${report.baseRef}`);
	console.log(
		`\nYou changed ${n(radius.changed.length)} file${radius.changed.length === 1 ? "" : "s"}.`,
	);

	const MAX_LISTED = 20;
	for (const impact of radius.changed.slice(0, MAX_LISTED)) {
		const symbols =
			impact.impactedSymbols.length > 0
				? `  (${impact.impactedSymbols.join(", ")})`
				: "";
		console.log(
			`  ${classLabels[impact.classification]}  ${impact.filePath}${symbols}`,
		);
	}
	if (radius.changed.length > MAX_LISTED) {
		console.log(`  … and ${n(radius.changed.length - MAX_LISTED)} more`);
	}

	console.log(
		`\nImpact: ${n(radius.affectedFiles.length)} file${radius.affectedFiles.length === 1 ? "" : "s"}${
			radius.affectedPackages.length > 0
				? `, ${n(radius.affectedPackages.length)} package${radius.affectedPackages.length === 1 ? "" : "s"} (${radius.affectedPackages.join(", ")})`
				: ""
		}`,
	);

	const skipped = tests.totalTests - tests.affectedTests.length;
	console.log(`\nRun:   ${n(tests.affectedTests.length)} test files`);
	console.log(
		`Skip:  ${n(skipped)} test files (of ${n(tests.totalTests)} total)`,
	);

	console.log(`\nVerdict:    ${verdictText[report.verdict]}`);
	console.log(
		`Confidence: ${Math.round(tests.confidence * 100)}%  (report-only — run the full suite; skipping unlocks after shadow-mode validation)`,
	);

	const notes = [...radius.notes, ...tests.notes];
	if (notes.length > 0) {
		console.log("\nNotes:");
		for (const note of notes) console.log(`  - ${note}`);
	}

	if (!report.historyLogged) {
		console.log(
			"\n(warning: could not write .antiscale/history/impact.jsonl — shadow-mode logging skipped)",
		);
	}
}
