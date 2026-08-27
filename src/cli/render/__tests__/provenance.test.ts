import { describe, expect, it } from "vitest";
import type { RunReason, TaskProvenance } from "../../../types/index.js";
import { provenanceLines } from "../provenance.js";

function provenance(
	reason: RunReason,
	overrides: Partial<TaskProvenance> = {},
): TaskProvenance {
	return {
		taskId: "web:test",
		reason,
		dirtyDependents: [],
		upstreamTasks: [],
		...overrides,
	};
}

describe("provenanceLines", () => {
	it("names the changed file for a task the diff put in scope", () => {
		const block = provenanceLines(
			provenance({
				kind: "affected-by",
				changedFiles: ["packages/api/src/db.ts"],
			}),
		);

		expect(block).toEqual(["ran because: packages/api/src/db.ts changed"]);
	});

	it("truncates a long changed-file list rather than dumping the diff", () => {
		const block = provenanceLines(
			provenance({
				kind: "affected-by",
				changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
			}),
		);

		expect(block[0]).toBe("ran because: a.ts, b.ts, c.ts and 2 more changed");
	});

	it("falls back to the diff itself when no file list survived", () => {
		const block = provenanceLines(
			provenance({ kind: "affected-by", changedFiles: [] }),
		);

		expect(block).toEqual(["ran because: affected by the current diff"]);
	});

	it("reports a cache miss as a hash mismatch, abbreviated", () => {
		const block = provenanceLines(
			provenance({
				kind: "cache-miss",
				expectedHash: "b4e5f60aaaaaaaa",
				actualHash: "a1b2c3d9999999",
			}),
		);

		expect(block).toEqual([
			"ran because: cache miss — inputs hash a1b2c3d, cached b4e5f60",
		]);
	});

	it("distinguishes a first run from an invalidation", () => {
		const block = provenanceLines(
			provenance({
				kind: "cache-miss",
				expectedHash: null,
				actualHash: "a1b2c3d",
			}),
		);

		expect(block).toEqual([
			"ran because: cache miss — nothing cached for this task yet",
		]);
		expect(block[0]).not.toContain("a1b2c3d");
	});

	it("explains an uncacheable task without inventing a change", () => {
		const block = provenanceLines(provenance({ kind: "always" }));

		expect(block).toEqual([
			"ran because: this task is never cached, so it runs every time",
		]);
	});

	it("lists the siblings invalidated alongside the failing task", () => {
		const block = provenanceLines(
			provenance(
				{ kind: "always" },
				{ dirtyDependents: ["web:build", "web:typecheck"] },
			),
		);

		expect(block).toHaveLength(2);
		expect(block[1]).toBe("also affected: web:build, web:typecheck");
	});

	it("truncates a wide dependent fan-out", () => {
		const block = provenanceLines(
			provenance(
				{ kind: "always" },
				{ dirtyDependents: ["a", "b", "c", "d", "e", "f", "g"] },
			),
		);

		expect(block[1]).toBe("also affected: a, b, c, d, e and 2 more");
	});

	it("omits the dependent line when nothing else was invalidated", () => {
		const block = provenanceLines(provenance({ kind: "always" }));

		expect(block).toHaveLength(1);
		expect(block[0]).not.toContain("also affected");
	});

	it("stays within the three lines a failure hint can afford", () => {
		const block = provenanceLines(
			provenance(
				{ kind: "affected-by", changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts"] },
				{
					dirtyDependents: ["a", "b", "c", "d", "e", "f"],
					upstreamTasks: ["api:build", "shared:build"],
				},
			),
		);

		expect(block.length).toBeLessThanOrEqual(3);
	});
});
