/**
 * @module
 * The git porcelain the rest of `core` builds on — `cache/git-diff`,
 * `semantic/blast-radius` and `pr` all read VCS state through here so the
 * "git is unavailable" fallback and the argument-injection guards are written
 * once instead of once per caller.
 *
 * Every function degrades rather than throwing: git may be missing, the repo
 * may be shallow, the ref may not exist. `null` means "no VCS information" —
 * callers skip the optimization instead of failing the build.
 */

/**
 * git pathspecs are POSIX-separated internally regardless of host OS. A path
 * built with `path.relative` carries backslashes on Windows, which `git show`
 * fails to resolve — silently making every file look new (and every export
 * look added, i.e. a false `breaking`).
 */
function toPosix(relPath: string): string {
	return relPath.replace(/\\/g, "/");
}

// execa is a heavy dependency and `core/cache/git-diff.ts` is on the static
// import path of every command via cli/context.ts. Loading it lazily here
// keeps it out of the startup cost of commands that never touch git.
async function git(cwd: string, args: string[]): Promise<string | null> {
	try {
		const { execa } = await import("execa");
		const { stdout } = await execa("git", args, { cwd });
		return stdout;
	} catch {
		return null;
	}
}

function toFileList(stdout: string | null): string[] | null {
	if (stdout === null) return null;
	return stdout
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Contents of `relPath` as of `ref`, or null when it did not exist there. */
export async function readFileAtRef(
	cwd: string,
	ref: string,
	relPath: string,
): Promise<string | null> {
	return git(cwd, ["show", `${ref}:${toPosix(relPath)}`]);
}

/**
 * Files differing between `ref` and the working tree.
 *
 * The trailing `--` terminates option parsing so a crafted ref (one starting
 * with `-`) is always treated as a revision, never as a git flag.
 */
export async function listChangedFiles(
	cwd: string,
	ref: string,
): Promise<string[] | null> {
	return toFileList(await git(cwd, ["diff", "--name-only", ref, "--"]));
}

/**
 * Files a branch adds relative to `ref` — the three-dot range, which diffs
 * against the merge base. This is what a PR shows: commits landing on the base
 * branch after the branch point are not attributed to the PR.
 */
export async function listChangedFilesSinceMergeBase(
	cwd: string,
	ref: string,
): Promise<string[] | null> {
	return toFileList(
		await git(cwd, ["diff", "--name-only", `${ref}...HEAD`, "--"]),
	);
}
