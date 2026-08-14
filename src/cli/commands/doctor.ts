import { hasFailure, runDiagnostics } from "../../core/doctor/diagnostics.js";
import { renderDiagnostics } from "../render/doctor.js";

export async function registerDoctorAction(): Promise<void> {
	const diagnostics = await runDiagnostics(process.cwd());
	renderDiagnostics(diagnostics);

	// Warnings are informational; only a hard failure fails the command.
	if (hasFailure(diagnostics)) process.exitCode = 1;
}
