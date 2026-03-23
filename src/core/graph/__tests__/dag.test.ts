import { describe, it, expect } from "vitest";
import { TaskGraph } from "../dag.js";
import { CycleError } from "../../errors.js";

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

  it("missing target throws an error", () => {
    const g = makeGraph({ A: [] });
    expect(() => g.toLevels("NOPE")).toThrow(/not found/);
  });

  it("disconnected deps: only pulls subgraph reachable from target", () => {
    // B and C are unrelated to target D
    const g = makeGraph({ A: [], B: ["C"], C: [], D: [] });
    // toLevels("D") should only include D, not A/B/C
    expect(g.toLevels("D")).toEqual([["D"]]);
  });
});
