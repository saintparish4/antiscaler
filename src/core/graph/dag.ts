import { ConfigError, CycleError } from "../errors.js";

export class TaskGraph {
	private tasks = new Set<string>();
	private deps = new Map<string, Set<string>>(); // task -> set of tasks it depends on
	private levelCache = new Map<string, string[][]>();

	addTask(name: string): void {
		if (!this.tasks.has(name)) {
			this.tasks.add(name);
			this.deps.set(name, new Set());
			this.levelCache.clear();
		}
	}

	addDependency(task: string, dependsOn: string): void {
		this.addTask(task);
		this.addTask(dependsOn);
		const taskDeps = this.deps.get(task);
		taskDeps?.add(dependsOn);
		this.levelCache.clear();
	}

	getDependencies(task: string): ReadonlySet<string> {
		return this.deps.get(task) ?? new Set();
	}

	toLevels(target: string): string[][] {
		const cached = this.levelCache.get(target);
		if (cached !== undefined) {
			// Defensive copy so callers can't mutate the cached array
			return cached.map((level) => [...level]);
		}

		if (!this.tasks.has(target)) {
			throw new ConfigError(`Task "${target}" not found in graph`);
		}

		// Only the target's own dependency closure participates: unrelated
		// tasks must not gate it, and a cycle elsewhere in the graph is not
		// this target's problem.
		const subgraph = new Set<string>();
		const stack = [target];
		while (stack.length) {
			const node = stack.pop();
			if (node === undefined) continue;
			if (subgraph.has(node)) continue;
			subgraph.add(node);
			for (const dep of this.deps.get(node) ?? []) {
				stack.push(dep);
			}
		}

		// Edges are stored as "task → its dependencies", so in-degree here
		// counts *dependents*: Kahn's runs over the reversed graph, which is
		// why the levels come out leaves-first and need reversing at the end.
		const inDegree = new Map<string, number>();
		for (const node of subgraph) inDegree.set(node, 0);
		for (const node of subgraph) {
			for (const dep of this.deps.get(node) ?? []) {
				if (subgraph.has(dep)) {
					inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
				}
			}
		}

		const levels: string[][] = [];
		let queue = [...subgraph].filter((n) => inDegree.get(n) === 0);
		let processed = 0;

		while (queue.length) {
			levels.push([...queue].sort()); // sort for determinism
			processed += queue.length;
			const next: string[] = [];

			for (const node of queue) {
				for (const dep of this.deps.get(node) ?? []) {
					if (subgraph.has(dep)) {
						const newDeg = (inDegree.get(dep) ?? 0) - 1;
						inDegree.set(dep, newDeg);
						if (newDeg === 0) next.push(dep);
					}
				}
			}

			queue = next;
		}

		// Anything Kahn's could not drain sits on a cycle.
		if (processed < subgraph.size) {
			const remaining = [...subgraph].filter((n) => (inDegree.get(n) ?? 0) > 0);
			throw new CycleError(remaining);
		}

		// Callers want execution order — deepest dependencies first — and the
		// reversed traversal above emits the target's own level last.
		const result = levels.reverse();
		this.levelCache.set(
			target,
			result.map((level) => [...level]),
		);
		return result;
	}
}
