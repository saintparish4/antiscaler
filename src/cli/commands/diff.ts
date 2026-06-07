import { readFile } from "node:fs/promises";
import path from "node:path";

export interface DiffActionOptions {
	/** Git ref to compare against. Defaults to HEAD~1. */
	base?: string;
}

export async function registerDiffAction(
	filePath: string,
	opts: DiffActionOptions = {},
): Promise<void> {
	const { classifyChange } = await import("../../core/semantic/differ.js");
	const { execa } = await import("execa");

	const cwd = process.cwd();
	const baseRef = opts.base ?? "HEAD~1";
	const absPath = path.resolve(cwd, filePath);
	const relPath = path.relative(cwd, absPath);

	// Retrieve the file as it existed at baseRef.
	// Falls back to empty string when the file is new (not yet in git history).
	let before = "";
	try {
		const { stdout } = await execa("git", ["show", `${baseRef}:${relPath}`], {
			cwd,
		});
		before = stdout;
	} catch {
		// New file or git unavailable — treat as empty baseline.
	}

	// Read current on-disk state. Falls back to empty string for deleted files.
	let after = "";
	try {
		after = await readFile(absPath, "utf8");
	} catch {
		// Deleted file — treat as empty after.
	}

	const result = await classifyChange({ filePath: relPath, before, after });

	const classLabel: Record<string, string> = {
		"non-impacting": "non-impacting  (safe to skip build)",
		internal: "internal       (non-exported change)",
		breaking: "breaking       (exported API changed)",
	};

	console.log(`\nFile:           ${result.filePath}`);
	console.log(`Base ref:       ${baseRef}`);
	console.log(`Classification: ${classLabel[result.classification]}`);

	const { added, removed, changed } = result.exportedSymbols;
	if (added.length > 0 || removed.length > 0 || changed.length > 0) {
		console.log("\nExported symbol changes:");
		if (added.length > 0) console.log(`  added:   ${added.join(", ")}`);
		if (removed.length > 0) console.log(`  removed: ${removed.join(", ")}`);
		if (changed.length > 0) console.log(`  changed: ${changed.join(", ")}`);
	}
}
