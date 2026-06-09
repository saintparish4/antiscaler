#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { AntiscaleError } from "../core/errors.js";
import type { ConcurrencyOpts } from "./parse-opts.js";
import { parseConcurrency } from "./parse-opts.js";

const _dir = dirname(fileURLToPath(import.meta.url));
const _pkg = JSON.parse(
	readFileSync(join(_dir, "..", "package.json"), "utf8"),
) as { version: string };

const program = new Command()
	.name("antiscaler")
	.description("Adaptive dev orchestration CLI")
	.version(_pkg.version);

program
	.command("build")
	.description("Run the build task")
	.option("-c, --concurrency <n>", "max tasks per DAG level")
	.option("--scope <sessionId>", "restrict build to packages in trace")
	.option("--trace <which>", "shorthand for --scope=last")
	.option(
		"--affected",
		"run only packages affected by changes since baseRef (includes cascade dependents)",
	)
	.option("--dry-run", "print the task plan without executing")
	.action(
		async (
			opts: ConcurrencyOpts & {
				scope?: string;
				trace?: string;
				affected?: boolean;
				dryRun?: boolean;
			},
		) => {
			const { registerBuildAction } = await import("./commands/build.js");
			const concurrency = parseConcurrency(opts);
			const scope = opts.scope ?? (opts.trace === "last" ? "last" : undefined);
			await registerBuildAction({
				...(concurrency !== undefined && { concurrency }),
				...(scope !== undefined && { scope }),
				...(opts.affected && { affected: true }),
				...(opts.dryRun && { dryRun: true }),
			});
		},
	);

const traceCmd = program
	.command("trace")
	.description("Run dev with tracing enabled (writes .antiscale/traces/)")
	.action(async () => {
		const { registerTraceAction } = await import("./commands/trace.js");
		await registerTraceAction();
	});

traceCmd
	.command("analyze [sessionId]")
	.description(
		"Analyze a trace file — show modules, routes, and package breakdown (default: last session)",
	)
	.action(async (sessionId?: string) => {
		const { registerTraceAnalyzeAction } = await import("./commands/trace.js");
		await registerTraceAnalyzeAction(sessionId);
	});

program
	.command("dev")
	.description("Start the dev server")
	.option(
		"-c, --concurrency <n>",
		"max tasks to run concurrently per DAG level",
	)
	.option("--dry-run", "print the task plan without executing")
	.action(async (opts: ConcurrencyOpts & { dryRun?: boolean }) => {
		const { registerDevAction } = await import("./commands/dev.js");
		const concurrency = parseConcurrency(opts);
		await registerDevAction({
			...(concurrency !== undefined && { concurrency }),
			...(opts.dryRun && { dryRun: true }),
		});
	});

program
	.command("run <task>")
	.description("Run a named task")
	.option(
		"-c, --concurrency <n>",
		"max tasks to run concurrently per DAG level",
	)
	.option("--dry-run", "print the task plan without executing")
	.action(async (taskName: string, opts: ConcurrencyOpts & { dryRun?: boolean }) => {
		const { registerRunAction } = await import("./commands/run.js");
		const concurrency = parseConcurrency(opts);
		await registerRunAction(taskName, {
			...(concurrency !== undefined && { concurrency }),
			...(opts.dryRun && { dryRun: true }),
		});
	});

program
	.command("init")
	.description("Scaffold antiscale.config.ts in the current directory")
	.action(async () => {
		const { registerInitAction } = await import("./commands/init.js");
		await registerInitAction();
	});

program
	.command("doctor")
	.description("Validate config, check traces, and diagnose common issues")
	.action(async () => {
		const { registerDoctorAction } = await import("./commands/doctor.js");
		await registerDoctorAction();
	});

program
	.command("insight")
	.description("Show task timing and cache hit stats")
	.action(async () => {
		const { registerInsightAction } = await import("./commands/insight.js");
		await registerInsightAction();
	});

program
	.command("env")
	.description(
		"Show detected environment (runtime, package manager, framework)",
	)
	.action(async () => {
		const { registerEnvAction } = await import("./commands/env.js");
		await registerEnvAction();
	});

program
	.command("check")
	.description("Validate config and task graph (no execution)")
	.action(async () => {
		const { registerCheckAction } = await import("./commands/check.js");
		await registerCheckAction();
	});

program
	.command("diff <file>")
	.description(
		"Classify a TypeScript file change as non-impacting / internal / breaking",
	)
	.option("--base <ref>", "git ref to compare against", "HEAD~1")
	.action(async (file: string, opts: { base: string }) => {
		const { registerDiffAction } = await import("./commands/diff.js");
		await registerDiffAction(file, { base: opts.base });
	});

const prCmd = program.command("pr").description("PR-aware analysis commands");

prCmd
	.command("check")
	.description(
		"Classify all TypeScript changes in this PR and report a build verdict",
	)
	.option("--base <ref>", "base branch or ref for the PR diff", "main")
	.action(async (opts: { base: string }) => {
		const { registerPrCheckAction } = await import("./commands/pr.js");
		await registerPrCheckAction({ base: opts.base });
	});

prCmd
	.command("replay")
	.description(
		"Intersect PR-changed files with the last trace session to find touched routes",
	)
	.option("--base <ref>", "base branch or ref for the PR diff", "main")
	.option("--session <id>", "trace session ID to replay (default: last)")
	.action(async (opts: { base: string; session?: string }) => {
		const { registerPrReplayAction } = await import("./commands/pr.js");
		await registerPrReplayAction(opts);
	});

prCmd
	.command("report")
	.description(
		"Combine pr check + pr replay into a structured JSON or markdown report",
	)
	.option("--base <ref>", "base branch or ref for the PR diff", "main")
	.option("--session <id>", "trace session ID to replay (default: last)")
	.option("--markdown", "output a markdown summary instead of JSON")
	.option("--output <file>", "write report to file instead of stdout")
	.action(
		async (opts: {
			base: string;
			session?: string;
			markdown?: boolean;
			output?: string;
		}) => {
			const { registerPrReportAction } = await import("./commands/pr.js");
			await registerPrReportAction(opts);
		},
	);

program.parseAsync(process.argv).catch((err: unknown) => {
	if (err instanceof AntiscaleError) {
		console.error(`[${err.code}] ${err.message}`);
		if (err.hint) console.error(`  Hint: ${err.hint}`);
		process.exit(1);
	}
	console.error("Unexpected error — please file a bug:", err);
	process.exit(2);
});
