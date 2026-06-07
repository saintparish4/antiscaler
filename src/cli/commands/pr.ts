import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClassifyResult } from "../../core/semantic/differ.js";

export type PrVerdict = "safe-to-skip" | "build-recommended" | "build-required";

export interface PrCheckResult {
	baseRef: string;
	tsFilesChanged: number;
	files: ClassifyResult[];
	verdict: PrVerdict;
}

export interface PrReplayResult {
	baseRef: string;
	sessionId: string;
	framework: string;
	changedFiles: string[];
	touchedModules: string[];
	touchedRoutes: Array<{ path: string; modules: string[] }>;
	touchedPackages: string[];
}

export interface PrReportResult {
	generatedAt: string;
	check: PrCheckResult;
	replay: PrReplayResult | null;
}

export interface PrCheckOptions {
	base?: string;
}

export interface PrReplayOptions {
	base?: string;
	session?: string;
}

export interface PrReportOptions {
	base?: string;
	session?: string;
	markdown?: boolean;
	output?: string;
}

async function getChangedFilesForPr(
	cwd: string,
	baseRef: string,
): Promise<string[]> {
	try {
		const { execa } = await import("execa");
		const { stdout } = await execa(
			"git",
			["diff", "--name-only", `${baseRef}...HEAD`],
			{ cwd },
		);
		return stdout
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	} catch {
		return [];
	}
}

export async function runPrCheck(
	cwd: string,
	opts: PrCheckOptions,
): Promise<PrCheckResult> {
	const { classifyChange } = await import("../../core/semantic/differ.js");
	const { execa } = await import("execa");
	const baseRef = opts.base ?? "main";

	const allChanged = await getChangedFilesForPr(cwd, baseRef);
	const tsFiles = allChanged.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const files: ClassifyResult[] = [];
	for (const relPath of tsFiles) {
		const absPath = path.resolve(cwd, relPath);

		let before = "";
		try {
			const { stdout } = await execa("git", ["show", `${baseRef}:${relPath}`], {
				cwd,
			});
			before = stdout;
		} catch {
			// new file — treat as empty baseline
		}

		let after = "";
		try {
			after = await readFile(absPath, "utf8");
		} catch {
			// deleted file — treat as empty
		}

		files.push(await classifyChange({ filePath: relPath, before, after }));
	}

	let verdict: PrVerdict = "safe-to-skip";
	for (const r of files) {
		if (r.classification === "breaking") {
			verdict = "build-required";
			break;
		}
		if (r.classification === "internal") {
			verdict = "build-recommended";
		}
	}

	return { baseRef, tsFilesChanged: tsFiles.length, files, verdict };
}

export async function runPrReplay(
	cwd: string,
	opts: PrReplayOptions,
): Promise<PrReplayResult | null> {
	const { loadTrace } = await import("../../core/scope/trace-loader.js");
	const { loadPackageGraph } = await import(
		"../../core/graph/package-graph.js"
	);
	const baseRef = opts.base ?? "main";
	const session = opts.session ?? "last";

	const trace = await loadTrace(cwd, session).catch(() => null);
	if (trace === null) return null;

	const pkgGraph = await loadPackageGraph(cwd).catch(() => ({
		packages: [] as Awaited<ReturnType<typeof loadPackageGraph>>["packages"],
		edges: new Map<string, ReadonlySet<string>>(),
	}));

	const changedFiles = await getChangedFilesForPr(cwd, baseRef);
	const absChangedSet = new Set(changedFiles.map((f) => path.resolve(cwd, f)));

	const touchedModules: string[] = [];
	for (const m of trace.modules) {
		if (absChangedSet.has(m.file)) {
			touchedModules.push(m.file);
		}
	}

	const touchedModuleSet = new Set(touchedModules);
	const touchedRoutes = trace.routes.filter((r) =>
		r.modules.some((m) => touchedModuleSet.has(m)),
	);

	const touchedPkgSet = new Set<string>();
	for (const cf of changedFiles) {
		const abs = path.resolve(cwd, cf);
		for (const pkg of pkgGraph.packages) {
			const rel = path.relative(pkg.dir, abs);
			if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
				touchedPkgSet.add(pkg.name);
				break;
			}
		}
	}

	return {
		baseRef,
		sessionId: trace.sessionId,
		framework: trace.framework,
		changedFiles,
		touchedModules,
		touchedRoutes,
		touchedPackages: [...touchedPkgSet],
	};
}

export async function registerPrCheckAction(
	opts: PrCheckOptions,
): Promise<void> {
	const cwd = process.cwd();
	const result = await runPrCheck(cwd, opts);

	const labels: Record<string, string> = {
		"non-impacting": "non-impacting",
		internal: "internal     ",
		breaking: "breaking     ",
	};
	const verdictText: Record<PrVerdict, string> = {
		"safe-to-skip": "safe to skip build",
		"build-recommended": "build recommended",
		"build-required": "build required",
	};

	console.log(`\nBase ref: ${result.baseRef}`);
	console.log(`Changed .ts files: ${result.tsFilesChanged}`);

	if (result.files.length > 0) {
		console.log("\nFile classifications:");
		for (const f of result.files) {
			const sym = f.exportedSymbols;
			const changes: string[] = [];
			if (sym.added.length > 0) changes.push(`+${sym.added.length} added`);
			if (sym.removed.length > 0)
				changes.push(`-${sym.removed.length} removed`);
			if (sym.changed.length > 0)
				changes.push(`~${sym.changed.length} changed`);
			const detail = changes.length > 0 ? `  (${changes.join(", ")})` : "";
			console.log(`  ${labels[f.classification]}  ${f.filePath}${detail}`);
		}
	}

	console.log(`\nVerdict: ${verdictText[result.verdict]}`);
}

export async function registerPrReplayAction(
	opts: PrReplayOptions,
): Promise<void> {
	const cwd = process.cwd();
	const result = await runPrReplay(cwd, opts);

	if (result === null) {
		console.log(
			"No trace session found. Run `antiscaler trace` first to record a session.",
		);
		return;
	}

	console.log(`\nBase ref:        ${result.baseRef}`);
	console.log(`Trace session:   ${result.sessionId}`);
	console.log(`Framework:       ${result.framework}`);
	console.log(`Changed files:   ${result.changedFiles.length}`);
	console.log(`Touched modules: ${result.touchedModules.length}`);

	if (result.touchedRoutes.length > 0) {
		console.log("\nTouched routes:");
		for (const r of result.touchedRoutes) {
			const mc = r.modules.length;
			console.log(`  ${r.path}  (${mc} ${mc === 1 ? "module" : "modules"})`);
		}
	} else {
		console.log("\nNo traced routes are touched by this PR.");
	}

	if (result.touchedPackages.length > 0) {
		console.log("\nTouched packages:");
		for (const p of result.touchedPackages) {
			console.log(`  ${p}`);
		}
	}
}

export async function registerPrReportAction(
	opts: PrReportOptions,
): Promise<void> {
	const cwd = process.cwd();

	const [check, replay] = await Promise.all([
		runPrCheck(cwd, opts),
		runPrReplay(cwd, opts),
	]);

	const report: PrReportResult = {
		generatedAt: new Date().toISOString(),
		check,
		replay,
	};

	if (opts.markdown) {
		const md = buildMarkdownSummary(report);
		if (opts.output) {
			await writeFile(path.resolve(cwd, opts.output), md, "utf8");
			console.log(`Markdown report written to ${opts.output}`);
		} else {
			console.log(md);
		}
		return;
	}

	const json = JSON.stringify(report, null, 2);
	if (opts.output) {
		await writeFile(path.resolve(cwd, opts.output), json, "utf8");
		console.log(`Report written to ${opts.output}`);
	} else {
		console.log(json);
	}
}

function buildMarkdownSummary(report: PrReportResult): string {
	const { check, replay } = report;

	const verdictEmoji: Record<PrVerdict, string> = {
		"safe-to-skip": "✅",
		"build-recommended": "⚠️",
		"build-required": "🔴",
	};
	const verdictLabel: Record<PrVerdict, string> = {
		"safe-to-skip": "Safe to skip build",
		"build-recommended": "Build recommended",
		"build-required": "Build required",
	};

	const lines: string[] = [
		"## Antiscaler PR Report",
		"",
		`**Generated:** ${report.generatedAt}  `,
		`**Base ref:** \`${check.baseRef}\`  `,
		"",
		"### Semantic Diff",
		"",
		`${verdictEmoji[check.verdict]} **${verdictLabel[check.verdict]}**`,
		"",
	];

	if (check.files.length > 0) {
		lines.push("| File | Classification | API Changes |");
		lines.push("|------|----------------|-------------|");
		for (const f of check.files) {
			const sym = f.exportedSymbols;
			const apiChanges: string[] = [];
			if (sym.added.length > 0) apiChanges.push(`+${sym.added.length}`);
			if (sym.removed.length > 0) apiChanges.push(`-${sym.removed.length}`);
			if (sym.changed.length > 0) apiChanges.push(`~${sym.changed.length}`);
			lines.push(
				`| \`${f.filePath}\` | ${f.classification} | ${apiChanges.join(" ") || "—"} |`,
			);
		}
		lines.push("");
	} else {
		lines.push("_No TypeScript files changed._", "");
	}

	if (replay) {
		lines.push("### Trace Replay", "");
		if (replay.touchedRoutes.length > 0) {
			lines.push(`**Touched routes (${replay.touchedRoutes.length}):**`, "");
			for (const r of replay.touchedRoutes) {
				lines.push(`- \`${r.path}\``);
			}
			lines.push("");
		} else {
			lines.push("_No traced routes are touched by this PR._", "");
		}
		if (replay.touchedPackages.length > 0) {
			lines.push(
				`**Touched packages:** ${replay.touchedPackages.map((p) => `\`${p}\``).join(", ")}`,
				"",
			);
		}
	} else {
		lines.push("### Trace Replay", "", "_No trace session available._", "");
	}

	return lines.join("\n");
}
