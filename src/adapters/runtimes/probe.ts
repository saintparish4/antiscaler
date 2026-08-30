import { execSync } from "node:child_process";

/**
 * `<binary> --version`, run at most once per process.
 *
 * `available()` and `version()` ask the same question of the same binary, so
 * without this a caller wanting both paid two spawns. The failure is cached
 * too, and deliberately so: a failed PATH search is the *expensive* case —
 * probing for an absent `bun` and `deno` measured 142 ms together under WSL2.
 */
export function createVersionProbe(
	binary: string,
	parse: (output: string) => string | null = (output) => output.trim(),
): () => string | null {
	// A `{ version }` box rather than a bare string, so a cached null is
	// distinguishable from "not probed yet".
	let cached: { version: string | null } | undefined;
	return () => {
		if (cached === undefined) {
			try {
				cached = {
					version: parse(
						execSync(`${binary} --version`, { stdio: "pipe" }).toString(),
					),
				};
			} catch {
				cached = { version: null };
			}
		}
		return cached.version;
	};
}
