/**
 * @module
 * The progress port. `core` reports task lifecycle changes through this
 * interface and knows nothing about terminals; every implementation lives in
 * `cli/visuals` (see `createTaskEventProgress`), which is what keeps `core`
 * free of output concerns.
 */

export type TaskStatus = "running" | "done" | "cached" | "failed";

export interface TaskEvent {
	task: string;
	status: TaskStatus;
	durationMs?: number;
}

export type OnTaskEvent = (event: TaskEvent) => void;
