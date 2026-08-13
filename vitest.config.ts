import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		coverage: {
			enabled: true,
			provider: "v8",
			include: ["src/core/**", "src/tracer/**", "src/cli/**"],
			exclude: ["**/__tests__/**", "**/types.ts", "src/types/**"],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 60,
				statements: 70,
			},
			reporter: ["text", "lcov"],
		},
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/__tests__/**/*.test.ts"],
					exclude: ["src/__tests__/integration/**", "src/__tests__/e2e/**"],
					testTimeout: 15_000,
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					include: ["src/__tests__/integration/**/*.integration.test.ts"],
					testTimeout: 30_000,
				},
			},
			{
				extends: true,
				test: {
					name: "e2e",
					include: ["src/__tests__/e2e/**/*.e2e.test.ts"],
					// Spawns the built dist/cli.js against fixture workspaces; a cold
					// build plus git setup runs well past the integration budget.
					testTimeout: 60_000,
				},
			},
		],
	},
});
