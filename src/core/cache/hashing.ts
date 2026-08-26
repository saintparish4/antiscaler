import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

export interface HashOptions {
	/** When set, only files inside these package dirs are read. */
	packageScopes?: string[];
	/** Concurrency for parallel readFile. Default 32. */
	parallel?: number;
}

function assertSafePattern(pattern: string): void {
	if (path.isAbsolute(pattern)) {
		throw new Error(
			`Unsafe glob pattern "${pattern}": patterns must be relative and must not traverse outside the project root.`,
		);
	}
	// Normalize separators then reject any ".." segment — catches "./../../etc/passwd" and similar.
	const segments = pattern.replace(/\\/g, "/").split("/");
	if (segments.some((seg) => seg === "..")) {
		throw new Error(
			`Unsafe glob pattern "${pattern}": patterns must be relative and must not traverse outside the project root.`,
		);
	}
}

export async function hashTaskInputs(
	cwd: string,
	patterns: string[],
	options: HashOptions = {},
): Promise<string> {
	for (const p of patterns) assertSafePattern(p);
	const files = (
		await fg(patterns, {
			cwd,
			onlyFiles: true,
			ignore: ["node_modules/**", ".git/**", ".link/**"],
		})
	).sort();

	const packageScopes = options.packageScopes;
	const inScope = packageScopes?.length
		? files.filter((f) =>
				packageScopes.some((dir) =>
					path.resolve(cwd, f).startsWith(path.resolve(dir) + path.sep),
				),
			)
		: files;

	const limit = Math.max(1, options.parallel ?? 32);
	const contents = new Array<Uint8Array>(inScope.length);
	let next = 0;
	const worker = async () => {
		while (true) {
			const i = next++;
			if (i >= inScope.length) return;
			const relPath = inScope[i];
			if (relPath === undefined) return;
			contents[i] = await readFile(path.join(cwd, relPath));
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, inScope.length || 1) }, worker),
	);

	const hash = createHash("sha256");
	for (let i = 0; i < inScope.length; i++) {
		const relPath = inScope[i];
		const content = contents[i];
		if (relPath === undefined || content === undefined) continue;
		hash.update(relPath);
		hash.update(content);
	}
	return hash.digest("hex");
}
