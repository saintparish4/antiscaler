import pc from "picocolors";

export type TaskStatus = "running" | "done" | "cached" | "failed";

export interface TaskEvent {
	task: string;
	status: TaskStatus;
	durationMs?: number;
}

export type OnTaskEvent = (event: TaskEvent) => void;

function useColor(): boolean {
	return !process.env["NO_COLOR"] && !process.env["CI"];
}

export function createProgressReporter(): OnTaskEvent {
	const colored = useColor();
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
		process.stderr.write(`${line}\n`);
	};
}
