import { createContext } from "../context.js";
import { renderEnv } from "../render/insight.js";

export async function registerEnvAction(): Promise<void> {
	const ctx = await createContext();
	renderEnv(ctx.pm, ctx.runtime, ctx.framework);
}
