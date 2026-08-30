/**
 * @module
 * Bounded-concurrency map. Lives on its own rather than inside `runner.ts`
 * because the semantic path needs it too, and importing the runner would drag
 * execa, hashing and the plugin registry onto the startup path of commands
 * that never execute a task.
 */

/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 * Preserves input order in the result array.
 *
 * stopOnError (default true): when any `fn` rejects, no NEW items are
 * picked up. Already-in-flight items finish; the first rejection is
 * re-thrown after every in-flight worker has settled. This avoids
 * killing processes mid-execution while still saving work on doomed runs.
 */
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	stopOnError = true,
): Promise<R[]> {
	const results: R[] = new Array<R>(items.length);
	let next = 0;
	let firstError: unknown = null;
	let stopped = false;

	const worker = async (): Promise<void> => {
		while (true) {
			if (stopped) return;
			const i = next++;
			if (i >= items.length) return;
			try {
				results[i] = await fn(items[i] as T, i);
			} catch (err) {
				if (firstError === null) firstError = err;
				if (stopOnError) stopped = true;
				return;
			}
		}
	};

	const workerCount = Math.max(1, Math.min(limit, items.length));
	await Promise.all(Array.from({ length: workerCount }, worker));

	if (firstError !== null) throw firstError;
	return results;
}
