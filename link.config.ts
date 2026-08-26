import { defineConfig } from "./src/index.js";

// Link dogfooding itself. Run `node dist/cli.js build` (or once
// published, `npx link build`) to typecheck + test + bundle in one DAG.
//
// The graph is:
//   build  →  typecheck
//          →  test
// Strategy is `adaptive`, so unchanged inputs produce a cache hit and the
// task is skipped — the whole point of the tool.
//
// `echoQuoted` (Phase 9 exit gate): quoted-arg parsing smoke —
//   node dist/cli.js run echoQuoted
// Expected stdout line: link ok
// TODO: remove the `echoQuoted` task before the 0.2.0 release — keep this file
// to real pipeline tasks only; executor tests already cover quoted argv.
//
// Phase 9 exit gate — strict + insight (manual): temporarily set
// `strategy: "strict"` below, then:
//   node dist/cli.js build
//   node dist/cli.js insight
// Expect "Cached task history" with build/typecheck/test each showing a
// duration. Revert to `adaptive` before commit. Automated guard:
//   src/core/execution/__tests__/runner.test.ts ("records lastRun...")
//   src/core/insight/__tests__/reporter.test.ts

export default defineConfig({
	strategy: "adaptive",
	tasks: {
		echoQuoted: {
			command: `node -e "console.log('link ok')"`,
			// Content cache: second `run echoQuoted` with unchanged config → HIT.
			inputs: ["link.config.ts"],
		},
		typecheck: {
			command: "npm run typecheck",
			inputs: ["src/**/*.ts", "tsconfig.json"],
		},
		test: {
			command: "npm run test:run",
			inputs: ["src/**/*.ts", "tsconfig.json"],
		},
		build: {
			command: "npm run build",
			dependsOn: ["typecheck", "test"],
			inputs: [
				"src/**/*.ts",
				"package.json",
				"tsconfig.json",
				"tsup.config.ts",
			],
		},
	},
});
