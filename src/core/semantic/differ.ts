/**
 * @module
 * AST-based change classifier. Compares two snapshots of the same file and
 * decides whether the change is non-impacting (comments / whitespace), internal
 * (implementation-only — function bodies, non-exported code), or breaking
 * (exported public API shape changed).
 *
 * The exported surface is compared structurally — parameters, return types, and
 * type shapes — never implementation text, so a body-only edit of an exported
 * function classifies as `internal`. Each changed symbol carries a `ChangeKind`
 * (`signature | body | type`) so downstream consumers can gate blast-radius
 * propagation precisely. Constructs that cannot be resolved from a single file
 * (`export *`, dynamic `import()`, declaration merging) lower the confidence
 * score instead of silently passing.
 */

import { collectExportedSurface, significantText } from "./surface.js";

export type SemanticClass = "non-impacting" | "internal" | "breaking";

/**
 * How an exported symbol changed:
 * - `signature` — runtime-visible API shape (parameters, return type, value type)
 * - `body` — implementation only; the public surface is unchanged
 * - `type` — type-space only (interfaces, type aliases, type-only re-exports)
 */
export type ChangeKind = "signature" | "body" | "type";

export interface SymbolChange {
	name: string;
	kind: ChangeKind;
}

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
		changed: SymbolChange[];
	};
	/** 1 when the export surface fully resolved; lowered per unresolvable construct. */
	confidence: number;
	/** Reasons the confidence was lowered (empty when confidence is 1). */
	confidenceNotes: string[];
}

export async function classifyChange(
	input: ClassifyInput,
): Promise<ClassifyResult> {
	// Lazy import keeps ts-morph (~50MB) out of the startup critical path.
	// Only loaded when semantic diff is actually needed.
	const tsm = await import("ts-morph");
	const project = new tsm.Project({ useInMemoryFileSystem: true });
	const beforeFile = project.createSourceFile("__before.ts", input.before);
	const afterFile = project.createSourceFile("__after.ts", input.after);

	const beforeApi = collectExportedSurface(beforeFile, tsm);
	const afterApi = collectExportedSurface(afterFile, tsm);

	const added: string[] = [];
	const removed: string[] = [];
	const changed: SymbolChange[] = [];

	for (const [name, after] of afterApi.symbols) {
		const before = beforeApi.symbols.get(name);
		if (before === undefined) {
			added.push(name);
		} else if (before.signature !== after.signature) {
			changed.push({
				name,
				kind: before.typeSpace && after.typeSpace ? "type" : "signature",
			});
		} else if (before.body !== after.body) {
			changed.push({ name, kind: "body" });
		}
	}
	for (const name of beforeApi.symbols.keys()) {
		if (!afterApi.symbols.has(name)) removed.push(name);
	}

	const surfaceChanged =
		added.length > 0 ||
		removed.length > 0 ||
		changed.some((c) => c.kind !== "body");

	let classification: SemanticClass;
	if (surfaceChanged) {
		classification = "breaking";
	} else if (
		changed.length > 0 ||
		significantText(input.before, tsm) !== significantText(input.after, tsm)
	) {
		classification = "internal";
	} else {
		classification = "non-impacting";
	}

	const confidenceNotes = [...new Set([...beforeApi.notes, ...afterApi.notes])];
	const confidence = Math.max(
		0.3,
		Math.round((1 - confidenceNotes.length * 0.15) * 100) / 100,
	);

	return {
		filePath: input.filePath,
		classification,
		exportedSymbols: { added, removed, changed },
		confidence,
		confidenceNotes,
	};
}
