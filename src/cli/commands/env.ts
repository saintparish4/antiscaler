export async function registerEnvAction(): Promise<void> {
	const { createContext } = await import("../context.js");
	const { printEnv } = await import("../../core/insight/reporter.js");

	const ctx = await createContext();
	printEnv(ctx.pm, ctx.runtime, ctx.framework);
}
