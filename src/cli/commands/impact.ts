import type { ImpactOptions } from "../../core/impact/predict.js";
import { predictImpact } from "../../core/impact/predict.js";
import {
	NO_CHANGED_FILES_MESSAGE,
	renderImpact,
	renderImpactJson,
} from "../render/impact.js";
import { lines } from "../render/writer.js";
import { getPrinter } from "../visuals/printer.js";

export interface ImpactActionOptions extends ImpactOptions {
	/** Print the report as JSON instead of the human block. */
	json?: boolean;
}

export async function registerImpactAction(
	opts: ImpactActionOptions = {},
): Promise<void> {
	const report = await predictImpact(process.cwd(), opts);

	if (report === null) {
		lines(getPrinter(), NO_CHANGED_FILES_MESSAGE);
		return;
	}

	if (opts.json === true) {
		renderImpactJson(report);
		return;
	}

	renderImpact(report);
}
