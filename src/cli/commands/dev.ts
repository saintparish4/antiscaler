export interface DevActionOptions {
	concurrency?: number;
}

export async function registerDevAction(
	opts: DevActionOptions = {},
): Promise<void> {
	const { createContext, toRunOptions } = await import("../context.js");
	const { runTasksWithDeps } = await import("../../core/execution/runner.js");

	const ctx = await createContext();
	await runTasksWithDeps("dev", ctx.graph, toRunOptions(ctx, opts));
}
