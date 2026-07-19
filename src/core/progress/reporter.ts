import pc from "picocolors";

export type TaskStatus = "running" | "done" | "cached" | "failed";

export interface TaskEvent {
	task: string;
	status: TaskStatus;
	durationMs?: number;
}

export type OnTaskEvent = (event: TaskEvent) => void;

export interface ProgressReporterOptions {
	/** Whether to color output; defaults to NO_COLOR/CI-aware detection. */
	colored?: boolean;
	/** Line sink (line includes its trailing newline); defaults to stderr. */
	write?: (line: string) => void;
}

function useColor(): boolean {
	return !process.env["NO_COLOR"] && !process.env["CI"];
}

export function createProgressReporter(
	options: ProgressReporterOptions = {},
): OnTaskEvent {
	const colored = options.colored ?? useColor();
	const write =
		options.write ??
		((line: string) => {
			process.stderr.write(line);
		});
	return ({ task, status, durationMs }) => {
		let line: string;
		switch (status) {
			case "running":
				line = colored ? pc.cyan(`  → ${task}`) : `  → ${task}`;
				break;
			case "cached":
				line = colored
					? pc.dim(`  · ${task} [cached]`)
					: `  · ${task} [cached]`;
				break;
			case "done": {
				const dur = durationMs !== undefined ? ` (${durationMs}ms)` : "";
				line = colored
					? `${pc.green(`  ✓ ${task}`)}${pc.dim(dur)}`
					: `  ✓ ${task}${dur}`;
				break;
			}
			case "failed":
				line = colored ? pc.red(`  ✗ ${task}`) : `  ✗ ${task}`;
				break;
		}
		write(`${line}\n`);
	};
}
