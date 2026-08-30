import { createContext } from "../context.js";
import { renderEnv } from "../render/insight.js";

export async function registerEnvAction(): Promise<void> {
	const ctx = await createContext(process.cwd(), { scope: false });
	renderEnv(ctx.pm, ctx.runtime, ctx.framework);
}
