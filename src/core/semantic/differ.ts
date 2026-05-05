/**
 * @module
 * AST-based change classifier. Compares two snapshots of the same file and
 * decides whether the change is non-impacting (comments / whitespace / unused
 * exports), internal (non-exported function bodies / private types), or
 * breaking (exported public API change).
 */

import type { SourceFile } from "ts-morph";
import { Project } from "ts-morph";

export type SemanticClass = "non-impacting" | "internal" | "breaking";

export interface ClassifyInput {
	filePath: string;
	before: string;
	after: string;
}

export interface ClassifyResult {
	filePath: string;
	classification: SemanticClass;
	exportedSymbols: {
		added: string[];
		removed: string[];
		changed: string[];
	};
}

export function classifyChange(input: ClassifyInput): ClassifyResult {
	const project = new Project({ useInMemoryFileSystem: true });
	const beforeFile = project.createSourceFile("__before.ts", input.before);
	const afterFile = project.createSourceFile("__after.ts", input.after);

	const beforeApi = collectExportedSurface(beforeFile);
	const afterApi = collectExportedSurface(afterFile);

	const added: string[] = [];
	const removed: string[] = [];
	const changed: string[] = [];

	for (const [name, sig] of afterApi) {
		const old = beforeApi.get(name);
		if (old === undefined) added.push(name);
		else if (old !== sig) changed.push(name);
	}
	for (const name of beforeApi.keys()) {
		if (!afterApi.has(name)) removed.push(name);
	}

	let classification: SemanticClass;
	if (added.length || removed.length || changed.length) {
		classification = "breaking";
	} else if (
		textWithoutTrivia(input.before) !== textWithoutTrivia(input.after)
	) {
		classification = "internal";
	} else {
		classification = "non-impacting";
	}

	return {
		filePath: input.filePath,
		classification,
		exportedSymbols: { added, removed, changed },
	};
}

function collectExportedSurface(file: SourceFile): Map<string, string> {
	const out = new Map<string, string>();
	for (const decl of file.getExportedDeclarations()) {
		const [name, nodes] = decl;
		const sig = nodes.map((n) => n.getText()).join("\n");
		out.set(name, sig);
	}
	return out;
}

function textWithoutTrivia(src: string): string {
	return src
		.replace(/\/\/.*$/gm, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\s+/g, " ")
		.trim();
}
