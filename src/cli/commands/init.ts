import { createInterface } from "node:readline/promises";
import { readFile, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { findAntiscaleConfigPath } from "../../core/config/loader.js";
import { detectProject } from "../../core/detection/project.js";

const DEFAULT_INPUTS: Record<string, string[]> = {
	build: ["src/**/*", "package.json"],
	lint: ["src/**/*", "*.config.*"],
	test: ["src/**/*", "**/__tests__/**/*"],
	typecheck: ["src/**/*", "tsconfig*.json"],
	format: ["src/**/*"],
};

const TASK_ORDER = ["build", "lint", "test", "typecheck", "format"];

function pmRunPrefix(pm: string): string {
	if (pm === "pnpm" || pm === "yarn") return pm;
	return "npm run";
}

function frameworkBin(pm: string): string {
	if (pm === "pnpm") return "pnpm";
	if (pm === "yarn") return "yarn";
	return "npx";
}

function defaultCommand(pm: string, task: string, framework: string | null): string {
	if (task === "build" && framework === "next") return `${frameworkBin(pm)} next build`;
	if (task === "build" && framework === "vite") return `${frameworkBin(pm)} vite build`;
	return `${pmRunPrefix(pm)} ${task}`;
}

async function detectExistingScripts(cwd: string): Promise<string[]> {
	try {
		const text = await readFile(path.join(cwd, "package.json"), "utf8");
		const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
		const found = Object.keys(pkg.scripts ?? {});
		const ordered = TASK_ORDER.filter((s) => found.includes(s));
		return ordered.length > 0 ? ordered : ["build", "lint", "test"];
	} catch {
		return ["build", "lint", "test"];
	}
}

function buildTemplate(
	tasks: Array<{ name: string; command: string; inputs: string[] }>,
): string {
	const taskLines = tasks
		.map(
			({ name, command, inputs }) =>
				`    ${name}: {\n      command: "${command}",\n      inputs: [${inputs.map((i) => `"${i}"`).join(", ")}],\n    }`,
		)
		.join(",\n");

	return `import { defineConfig } from "antiscaler";

export default defineConfig({
  strategy: "adaptive",
  tasks: {
${taskLines},
  },
});
`;
}

export async function registerInitAction(): Promise<void> {
	const cwd = process.cwd();
	const existing = findAntiscaleConfigPath(cwd);
	if (existing) {
		console.log(`${path.basename(existing)} already exists — nothing written.`);
		return;
	}

	const [{ pm, framework }, detectedScripts] = await Promise.all([
		detectProject(cwd),
		detectExistingScripts(cwd),
	]);
	const pmName = pm.name;
	const frameworkName = framework?.name ?? null;

	if (!process.stdin.isTTY) {
		// Non-interactive fallback: write minimal config with detected PM/framework
		const tasks = [{ name: "build", command: defaultCommand(pmName, "build", frameworkName), inputs: DEFAULT_INPUTS["build"] ?? [] }];
		writeFileSync(path.join(cwd, "antiscale.config.ts"), buildTemplate(tasks));
		console.log(`Created antiscale.config.ts (non-interactive, detected ${pmName}${frameworkName ? `/${frameworkName}` : ""})`);
		return;
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout });

	try {
		console.log(`\nDetected: ${pmName}${frameworkName ? ` · ${frameworkName}` : ""} · scripts: ${detectedScripts.join(", ")}\n`);

		const defaultTaskList = detectedScripts.join(",");
		const rawTasks = await rl.question(`Tasks to configure [${defaultTaskList}]: `);
		const taskNames = rawTasks.trim()
			? rawTasks.split(",").map((t) => t.trim()).filter(Boolean)
			: detectedScripts;

		const tasks: Array<{ name: string; command: string; inputs: string[] }> = [];
		for (const name of taskNames) {
			const suggested = defaultCommand(pmName, name, frameworkName);
			const rawCmd = await rl.question(`  Command for "${name}" [${suggested}]: `);
			const command = rawCmd.trim() || suggested;
			const suggestedInputs = (DEFAULT_INPUTS[name] ?? DEFAULT_INPUTS["build"] ?? []).join(", ");
			const rawInputs = await rl.question(`  Inputs for "${name}" [${suggestedInputs}]: `);
			const inputs = rawInputs.trim()
				? rawInputs.split(",").map((s) => s.trim()).filter(Boolean)
				: (DEFAULT_INPUTS[name] ?? DEFAULT_INPUTS["build"] ?? []);
			tasks.push({ name, command, inputs });
		}

		const dest = path.join(cwd, "antiscale.config.ts");
		await writeFile(dest, buildTemplate(tasks));
		console.log(`\nCreated antiscale.config.ts — run \`antiscaler doctor\` to verify.`);
	} finally {
		rl.close();
	}
}
