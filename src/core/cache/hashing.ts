import { createHash } from "crypto";
import { readFile } from "fs/promises";
import fg from "fast-glob";
import path from "path";

export async function hashTaskInputs(
  cwd: string,
  patterns: string[],
): Promise<string> {
  const hash = createHash("sha256");
  const files = await fg(patterns, {
    cwd,
    onlyFiles: true,
    ignore: ["node_modules/**", ".git/**", ".antiscale/**"],
  });

  for (const file of files.sort()) {
    const content = await readFile(path.join(cwd, file));
    hash.update(file); // include relative path so renames change the hash
    hash.update(content); // include file content
  }

  return hash.digest("hex");
}
