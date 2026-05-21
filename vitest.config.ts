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
				functions: 64,
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
					exclude: ["src/__tests__/integration/**"],
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
		],
	},
});
