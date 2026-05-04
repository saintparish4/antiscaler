import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: [
      "src/__tests__/integration/**/*.integration.test.ts",
      "node_modules/**",
    ],
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/__tests__/**/*.test.ts"],
          exclude: ["src/__tests__/integration/**"],
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
