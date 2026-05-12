import { describe, expect, it } from "vitest";
import { ConfigError, CycleError } from "../../errors.js";
import { TaskGraph } from "../dag.js";

// Helper: build a graph from an adjaceny lsit { task: [deps] }
function makeGraph(edges: Record<string, string[]>): TaskGraph {
	const g = new TaskGraph();
	for (const [task, deps] of Object.entries(edges)) {
		g.addTask(task);
		for (const dep of deps) g.addDependency(task, dep);
	}
	return g;
}

describe("TaskGraph.toLevels", () => {
	it("linear chain: A -> B -> C produces [[A], [B], [C]]", () => {
		// A depends on B, B depends on C
		const g = makeGraph({ A: ["B"], B: ["C"] });
		expect(g.toLevels("A")).toEqual([["C"], ["B"], ["A"]]);
	});

	it("diamond: A -> B, A -> C, B -> D, C -> D produces [[D], [B, C], [A]]", () => {
		const g = makeGraph({ A: ["B", "C"], B: ["D"], D: [] });
		const levels = g.toLevels("A");
		expect(levels[0]).toEqual(["D"]);
		expect(levels[1]).toEqual(["B", "C"]);
		expect(levels[2]).toEqual(["A"]);
	});

	it("cycle detection: A -> B -> A throws CycleError", () => {
		const g = makeGraph({ A: ["B"], B: ["A"] });
		expect(() => g.toLevels("A")).toThrow(CycleError);
	});

	it("single node with no deps produces [[A]]", () => {
		const g = makeGraph({ A: [] });
		expect(g.toLevels("A")).toEqual([["A"]]);
	});

	it("missing target throws ConfigError", () => {
		const g = makeGraph({ A: [] });
		expect(() => g.toLevels("NOPE")).toThrow(ConfigError);
		expect(() => g.toLevels("NOPE")).toThrow(/not found/);
	});

	it("disconnected deps: only pulls subgraph reachable from target", () => {
		// B and C are unrelated to target D
		const g = makeGraph({ A: [], B: ["C"], C: [], D: [] });
		// toLevels("D") should only include D, not A/B/C
		expect(g.toLevels("D")).toEqual([["D"]]);
	});

	it("self-loop: A -> A throws CycleError", () => {
		const g = new TaskGraph();
		g.addTask("A");
		g.addDependency("A", "A");
		expect(() => g.toLevels("A")).toThrow(CycleError);
	});

	it("level cache invalidated on addTask", () => {
		const g = makeGraph({ A: ["B"] });
		const first = g.toLevels("A");
		g.addTask("C");
		g.addDependency("A", "C");
		const second = g.toLevels("A");
		expect(second.flat()).toContain("C");
		expect(first.flat()).not.toContain("C");
	});

	it("defensive copy: mutating returned array does not corrupt cache", () => {
		const g = makeGraph({ A: ["B"] });
		const first = g.toLevels("A");
		first[0]?.push("INJECTED");
		const second = g.toLevels("A");
		expect(second.flat()).not.toContain("INJECTED");
	});

	it("addDependency to unknown tasks creates them implicitly", () => {
		const g = new TaskGraph();
		g.addDependency("X", "Y");
		expect(g.toLevels("X")).toEqual([["Y"], ["X"]]);
	});
});
