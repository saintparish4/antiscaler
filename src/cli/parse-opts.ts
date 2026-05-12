import { CliUsageError } from "../core/errors.js";

export interface ConcurrencyOpts {
	concurrency?: string;
}

export function parseConcurrency(opts: ConcurrencyOpts): number | undefined {
	if (opts.concurrency === undefined) return undefined;
	const n = Number.parseInt(opts.concurrency, 10);
	if (!Number.isFinite(n) || n < 1 || String(n) !== opts.concurrency.trim()) {
		throw new CliUsageError(
			`--concurrency must be a positive integer, got "${opts.concurrency}"`,
		);
	}
	return n;
}
