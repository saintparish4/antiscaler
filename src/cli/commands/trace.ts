import { runTasksWithDeps } from "../../core/execution/runner.js";
import { createContext, toRunOptions } from "../context.js";

export async function registerTraceAction(): Promise<void> {
	const ctx = await createContext();
	Reflect.set(process.env, "ANTISCALER_TRACE", "1");
	await runTasksWithDeps("dev", ctx.graph, toRunOptions(ctx));
}
