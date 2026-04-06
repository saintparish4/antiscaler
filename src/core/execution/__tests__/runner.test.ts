import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { runTasksWithDeps, type TaskRunResult } from "../runner.js";
import { TaskGraph } from "../../graph/dag.js";
import { writeCache } from "../../cache/store.js";
import { hashTaskInputs } from "../../cache/hashing.js";
import { TaskExecutionError } from "../../errors.js";
import type { ResolvedAntiscaleConfig } from "../../../types/index.js";

function makeTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "antiscale-runner-test-"));
}

function makeConfig(
  strategy: "adaptive" | "strict" = "adaptive",
): ResolvedAntiscaleConfig {
  return {
    strategy,
    cache: { mode: "content", directory: ".antiscale/cache" },
    tasks: {},
  };
}

function makeGraph(
  tasks: Array<{ name: string; deps?: string[] }>,
): TaskGraph {
  const graph = new TaskGraph();
  for (const { name, deps } of tasks) {
    graph.addTask(name);
    for (const dep of deps ?? []) {
      graph.addDependency(name, dep);
    }
  }
  return graph;
}

describe("runTasksWithDeps", () => {
  let cwd: string;
  let cacheDir: string;

  beforeEach(() => {
    cwd = makeTempDir();
    cacheDir = path.join(makeTempDir(), ".antiscale/cache");
  });

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  it("skips execution on cache hit", async () => {
    // Create a real file so hashTaskInputs can hash it
    writeFileSync(path.join(cwd, "main.ts"), "export const x = 1;");

    const patterns = ["main.ts"];
    const hash = await hashTaskInputs(cwd, patterns);

    // Pre-populate cache with the current hash
    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, {
      tasks: { build: { hash, lastRun: Date.now() } },
    });

    const config: ResolvedAntiscaleConfig = {
      ...makeConfig("adaptive"),
      tasks: { build: { inputs: patterns } },
    };
    const graph = makeGraph([{ name: "build" }]);
    const executor = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const results: TaskRunResult[] = await runTasksWithDeps("build", graph, {
      cwd,
      cacheDir,
      pm: "npm",
      config,
      tasks: config.tasks,
    }, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.cacheHit).toBe(true);
    expect(results[0]?.durationMs).toBe(0);
  });

  // ── 2. Cache miss ────────────────────────────────────────────────────────
  it("executes on cache miss (stale hash)", async () => {
    writeFileSync(path.join(cwd, "main.ts"), "export const x = 1;");

    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, {
      tasks: { build: { hash: "stale-hash", lastRun: Date.now() } },
    });

    const config: ResolvedAntiscaleConfig = {
      ...makeConfig("adaptive"),
      tasks: { build: { inputs: ["main.ts"] } },
    };
    const graph = makeGraph([{ name: "build" }]);
    const executor = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const results: TaskRunResult[] = await runTasksWithDeps("build", graph, {
      cwd,
      cacheDir,
      pm: "npm",
      config,
      tasks: config.tasks,
    }, executor);

    expect(executor).toHaveBeenCalledOnce();
    expect(results[0]?.cacheHit).toBe(false);
  });

  // ── 3. Parallel levels ───────────────────────────────────────────────────
  it("runs tasks in the same level concurrently", async () => {
    // lint and test are independent (same level), build depends on both
    const callOrder: string[] = [];
    const executor = vi
      .fn<(name: string) => Promise<void>>()
      .mockImplementation(async (name: string) => {
        callOrder.push(`start:${name}`);
        await new Promise<void>((res) => setTimeout(res, 10));
        callOrder.push(`end:${name}`);
      });

    const config: ResolvedAntiscaleConfig = {
      ...makeConfig("adaptive"),
      tasks: {
        lint: {},
        test: {},
        build: { dependsOn: ["lint", "test"] },
      },
    };
    const graph = makeGraph([
      { name: "lint" },
      { name: "test" },
      { name: "build", deps: ["lint", "test"] },
    ]);

    const results: TaskRunResult[] = await runTasksWithDeps("build", graph, {
      cwd,
      cacheDir,
      pm: "npm",
      config,
      tasks: config.tasks,
    }, executor as TaskExecutor);

    // Both lint and test should have started before either finishes
    const lintStart = callOrder.indexOf("start:lint");
    const testStart = callOrder.indexOf("start:test");
    const lintEnd = callOrder.indexOf("end:lint");
    const testEnd = callOrder.indexOf("end:test");

    expect(lintStart).not.toBe(-1);
    expect(testStart).not.toBe(-1);
    // In concurrent execution, both start before the first end
    expect(Math.min(lintEnd, testEnd)).toBeGreaterThan(Math.max(lintStart, testStart));
    expect(results).toHaveLength(3);
  });

  // ── 4. Task failure ──────────────────────────────────────────────────────
  it("propagates TaskExecutionError on task failure", async () => {
    const config: ResolvedAntiscaleConfig = {
      ...makeConfig("adaptive"),
      tasks: { build: {} },
    };
    const graph = makeGraph([{ name: "build" }]);
    const executor = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new TaskExecutionError("build", 1));

    await expect(
      runTasksWithDeps("build", graph, {
        cwd,
        cacheDir,
        pm: "npm",
        config,
        tasks: config.tasks,
      }, executor),
    ).rejects.toBeInstanceOf(TaskExecutionError);
  });

  // ── 5. Strict mode ───────────────────────────────────────────────────────
  it("always executes in strict mode, ignoring cache", async () => {
    writeFileSync(path.join(cwd, "main.ts"), "export const x = 1;");

    const patterns = ["main.ts"];
    const hash = await hashTaskInputs(cwd, patterns);

    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, {
      tasks: { build: { hash, lastRun: Date.now() } },
    });

    const config: ResolvedAntiscaleConfig = {
      ...makeConfig("strict"),
      tasks: { build: { inputs: patterns } },
    };
    const graph = makeGraph([{ name: "build" }]);
    const executor = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const results: TaskRunResult[] = await runTasksWithDeps("build", graph, {
      cwd,
      cacheDir,
      pm: "npm",
      config,
      tasks: config.tasks,
    }, executor);

    expect(executor).toHaveBeenCalledOnce();
    expect(results[0]?.cacheHit).toBe(false);
  });
});

// Re-export type so the mock cast works cleanly
import type { TaskExecutor } from "../executor.js";
