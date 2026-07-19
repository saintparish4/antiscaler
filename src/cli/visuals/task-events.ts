import type { OnTaskEvent, TaskEvent } from "../../core/progress/reporter.js";
import { getColors } from "./color.js";
import type { Printer } from "./printer.js";
import { getPrinter } from "./printer.js";
import { ProgressReporter } from "./progress.js";

export interface TaskEventProgress {
	/** Assign to `RunOptions.onTaskEvent` before calling the runner. */
	onTaskEvent: OnTaskEvent;
	/**
	 * Streams captured task output as dim, task-prefixed permanent lines above
	 * the live block. Defined only while progress is animating — when
	 * undefined, leave `RunOptions.onTaskOutput` unset so task stdio stays
	 * inherited and plain output flows through untouched.
	 */
	onTaskOutput: ((task: string, line: string) => void) | undefined;
	/** Clear the live block and restore the cursor. Idempotent — call it in a `finally` so a failed run never leaves a dangling spinner. */
	finish: () => void;
}

/**
 * Bridge runner task events onto a {@link ProgressReporter}: on a TTY, a root
 * spinner with in-flight tasks pinned as headers and completions logged above
 * the block; when progress is hidden (pipes, CI, `--no-progress`, quiet), the
 * same events degrade to the classic per-line log (`→` / `✓` / `·` / `✗`).
 */
export function createTaskEventProgress(
	message: string,
	printer: Printer = getPrinter(),
): TaskEventProgress {
	const reporter = ProgressReporter.spinner(printer, message);
	const running = new Map<string, number>();

	const completeWith = (task: string, line: string): void => {
		const id = running.get(task);
		running.delete(task);
		if (id !== undefined) reporter.completeTask(id, line);
		else reporter.log(line);
	};

	const onTaskEvent = ({ task, status, durationMs }: TaskEvent): void => {
		const colors = getColors();
		switch (status) {
			case "running":
				// pinLine (not startTask) so the header's indent matches the
				// "  ✓ task" completion line — no horizontal shift on finish.
				running.set(
					task,
					reporter.pinLine(`  ${colors.bold(colors.cyan("→"))} ${task}`),
				);
				break;
			case "cached":
				reporter.log(colors.dim(`  · ${task} [cached]`));
				break;
			case "done": {
				const duration =
					durationMs !== undefined ? colors.dim(` (${durationMs}ms)`) : "";
				completeWith(task, `${colors.green(`  ✓ ${task}`)}${duration}`);
				break;
			}
			case "failed":
				completeWith(task, colors.red(`  ✗ ${task}`));
				break;
		}
	};

	const onTaskOutput = printer.progressEnabled
		? (task: string, line: string): void => {
				const colors = getColors();
				reporter.log(`${colors.dim(`  ${task} │`)} ${line}`);
			}
		: undefined;

	return {
		onTaskEvent,
		onTaskOutput,
		finish: () => {
			reporter.finish();
		},
	};
}
