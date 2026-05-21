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
	.action(
		async (opts: ConcurrencyOpts & { scope?: string; trace?: string }) => {
			const { registerBuildAction } = await import("./commands/build.js");
			const concurrency = parseConcurrency(opts);
			const scope = opts.scope ?? (opts.trace === "last" ? "last" : undefined);
			await registerBuildAction({
				...(concurrency !== undefined && { concurrency }),
				...(scope !== undefined && { scope }),
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
	.action(async (opts: ConcurrencyOpts) => {
		const { registerDevAction } = await import("./commands/dev.js");
		const concurrency = parseConcurrency(opts);
		await registerDevAction(concurrency !== undefined ? { concurrency } : {});
	});

program
	.command("run <task>")
	.description("Run a named task")
	.option(
		"-c, --concurrency <n>",
		"max tasks to run concurrently per DAG level",
	)
	.action(async (taskName: string, opts: ConcurrencyOpts) => {
		const { registerRunAction } = await import("./commands/run.js");
		const concurrency = parseConcurrency(opts);
		await registerRunAction(
			taskName,
			concurrency !== undefined ? { concurrency } : {},
		);
	});

program
	.command("init")
	.description("Scaffold antiscale.config.ts in the current directory")
	.action(async () => {
		const { registerInitAction } = await import("./commands/init.js");
		await registerInitAction();
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

program.parseAsync(process.argv).catch((err: unknown) => {
	if (err instanceof AntiscaleError) {
		console.error(`[${err.code}] ${err.message}`);
		process.exit(1);
	}
	console.error("Unexpected error — please file a bug:", err);
	process.exit(2);
});
