import { ConfigError, CycleError } from "../errors.js";

export class TaskGraph {
    private tasks =new Set<string>(); 
    private deps = new Map<string, Set<string>>(); // task -> set of tasks it depends on 

    addTask(name: string): void {
        if (!this.tasks.has(name)) {
            this.tasks.add(name); 
            this.deps.set(name, new Set());  
        }
    }

    addDependency(task: string, dependsOn: string): void {
        this.addTask(task);  
        this.addTask(dependsOn); 
        this.deps.get(task)!.add(dependsOn);  
    }

    toLevels(target: string): string[][] {
        if (!this.tasks.has(target)) {
            throw new ConfigError(`Task "${target}" not found in graph`);
        }

        // 1. Collect subgraph reachable from target (BFS/DFS over dependsOn) 
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

        // 2. Compute in-degree within subgraph
    //    "in-degree" here = number of tasks in subgraph that depend ON this node
    const inDegree = new Map<string, number>();
    for (const node of subgraph) inDegree.set(node, 0);
    for (const node of subgraph) {
      for (const dep of this.deps.get(node) ?? []) {
        if (subgraph.has(dep)) {
          inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
        }
      }
    }

    // 3. Kahn's — level by level
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

    // 4. Cycle check
    if (processed < subgraph.size) {
      // Find cycle path for the error
      const remaining = [...subgraph].filter((n) => (inDegree.get(n) ?? 0) > 0);
      throw new CycleError(remaining);
    }

    // levels[0] = leaves (no dependents), last level = target
    // Reverse so target's level is first (execution order: deepest deps first)
    return levels.reverse();
  }
}