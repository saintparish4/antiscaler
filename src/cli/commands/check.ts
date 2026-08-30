import { validateTaskGraph } from "../../core/graph/validation.js";
import { createContext } from "../context.js";
import { lines } from "../render/writer.js";
import { getPrinter } from "../visuals/printer.js";

export async function registerCheckAction(): Promise<void> {
	const ctx = await createContext(process.cwd(), { scope: false });
	validateTaskGraph(ctx.config.tasks, ctx.graph);
	lines(getPrinter(), "Config and graph are valid.");
}
