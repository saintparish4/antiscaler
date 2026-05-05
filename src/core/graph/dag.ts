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

	toLevels(target: string): string[][] {
		const cached = this.levelCache.get(target);
		if (cached !== undefined) {
			// Defensive copy so callers can't mutate the cached array
			return cached.map((level) => [...level]);
		}

		if (!this.tasks.has(target)) {
			throw new ConfigError(`Task "${target}" not found in graph`);
		}

		// Collect subgraph reachable from target (BFS/DFS over dependsOn)
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

		// Compute in-degree within subgraph
		// "in-degree" here = number of tasks in subgraph that depend ON this node
		const inDegree = new Map<string, number>();
		for (const node of subgraph) inDegree.set(node, 0);
		for (const node of subgraph) {
			for (const dep of this.deps.get(node) ?? []) {
				if (subgraph.has(dep)) {
					inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
				}
			}
		}

		// Kahn's -- level by level
		const levels: string[][] = [];
		let queue = [...subgraph].filter((n) => inDegree.get(n) === 0);
		let processed = 0;

		while (queue.length) {
			levels.push([...queue].sort()); // sort for determinism
			processed += queue.length;
			const next: string[] = [];

			for (const node of queue) {
				// node is processed; each direct dependency loses one dependent
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

		// Cycle check
		if (processed < subgraph.size) {
			const remaining = [...subgraph].filter((n) => (inDegree.get(n) ?? 0) > 0);
			throw new CycleError(remaining);
		}

		// levels[0] = leaves (no dependents), last level = target
		// Reverse so target's level is first (execution order: deepest deps first)
		const result = levels.reverse();
		this.levelCache.set(
			target,
			result.map((level) => [...level]),
		);
		return result;
	}
}
