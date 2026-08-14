import { auditWorkspace } from "../../core/graph/workspace-audit.js";
import {
	NO_WORKSPACE_MESSAGE,
	renderWorkspaceCheck,
} from "../render/workspace.js";
import { lines } from "../render/writer.js";
import { getPrinter } from "../visuals/printer.js";

export interface WorkspaceCheckOptions {
	/** Print the result as JSON instead of the human report. */
	json?: boolean;
}

export async function registerWorkspaceCheckAction(
	opts: WorkspaceCheckOptions = {},
): Promise<void> {
	const result = await auditWorkspace(process.cwd());

	if (result === null) {
		lines(getPrinter(), NO_WORKSPACE_MESSAGE);
		return;
	}

	if (opts.json === true) {
		lines(getPrinter(), JSON.stringify(result, null, 2));
	} else {
		renderWorkspaceCheck(result);
	}

	// This command is a CI gate: violations must fail the pipeline. Setting
	// exitCode rather than calling process.exit lets stdout flush first.
	if (result.violations.length > 0) process.exitCode = 1;
}
