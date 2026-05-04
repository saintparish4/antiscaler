import { createHash } from "crypto";
import { readFile } from "fs/promises";
import fg from "fast-glob";
import path from "path";

export interface HashOptions {
  /** When set, only files inside these package dirs are read. */
  packageScopes?: string[];
  /** Concurrency for parallel readFile. Default 32. */
  parallel?: number;
}

export async function hashTaskInputs(
  cwd: string,
  patterns: string[],
  options: HashOptions = {},
): Promise<string> {
  const files = (
    await fg(patterns, {
      cwd,
      onlyFiles: true,
      ignore: ["node_modules/**", ".git/**", ".antiscale/**"],
    })
  ).sort();

  const inScope =
    options.packageScopes && options.packageScopes.length
      ? files.filter((f) =>
          options.packageScopes!.some((dir) =>
            path.resolve(cwd, f).startsWith(path.resolve(dir) + path.sep),
          ),
        )
      : files;

  const limit = Math.max(1, options.parallel ?? 32);
  const contents = new Array<Buffer>(inScope.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= inScope.length) return;
      contents[i] = await readFile(path.join(cwd, inScope[i]!));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, inScope.length || 1) }, worker),
  );

  const hash = createHash("sha256");
  for (let i = 0; i < inScope.length; i++) {
    hash.update(inScope[i]!);
    hash.update(contents[i]!);
  }
  return hash.digest("hex");
}
