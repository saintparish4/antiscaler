import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { findAntiscaleConfigPath, loadConfig } from "../../core/config/loader.js";

interface CheckResult {
	ok: boolean;
	warn?: boolean;
	label: string;
	detail?: string;
}

function icon(r: CheckResult): string {
	if (!process.env["NO_COLOR"] && !process.env["CI"]) {
		if (r.ok) return pc.green("[✓]");
		if (r.warn) return pc.yellow("[!]");
		return pc.red("[✗]");
	}
	return r.ok ? "[ok]" : r.warn ? "[!]" : "[x]";
}

function checkNodeVersion(): CheckResult {
	const match = process.version.match(/^v(\d+)/);
	const major = match ? Number(match[1]) : 0;
	if (major >= 20) {
		return { ok: true, label: `Node ${process.version} meets requirement ≥20` };
	}
	return {
		ok: false,
		label: `Node ${process.version} is below requirement ≥20`,
		detail: "Upgrade Node.js to v20 or later.",
	};
}

async function dirSizeBytes(dir: string): Promise<number> {
	let total = 0;
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return 0;
	}
	await Promise.all(
		entries.map(async (e) => {
			const full = path.join(dir, e);
			try {
				const s = await stat(full);
				if (s.isDirectory()) {
					total += await dirSizeBytes(full);
				} else {
					total += s.size;
				}
			} catch {
				// ignore inaccessible entries
			}
		}),
	);
	return total;
}

async function checkCacheSize(cwd: string, cacheDir: string): Promise<CheckResult> {
	const absCache = path.resolve(cwd, cacheDir);
	const bytes = await dirSizeBytes(absCache);
	const mb = bytes / (1024 * 1024);
	if (mb > 500) {
		return {
			ok: false,
			warn: true,
			label: `Cache directory is ${mb.toFixed(0)} MB`,
			detail: "Consider setting `cache.ttlDays` to evict old entries automatically.",
		};
	}
	return { ok: true, label: `Cache directory is ${mb.toFixed(0)} MB` };
}

async function checkTraces(cwd: string): Promise<CheckResult> {
	const traceDir = path.resolve(cwd, ".antiscale/traces");
	let files: string[];
	try {
		files = (await readdir(traceDir)).filter((f) => f.endsWith(".json"));
	} catch {
		return {
			ok: false,
			warn: true,
			label: "No trace sessions found",
			detail: "Run `antiscaler trace` to record a session (needed for scope/criticalPaths features).",
		};
	}
	if (files.length === 0) {
		return {
			ok: false,
			warn: true,
			label: "Trace directory exists but contains no sessions",
			detail: "Run `antiscaler trace` to record a session.",
		};
	}
	return { ok: true, label: `${files.length} trace session(s) found` };
}

export async function registerDoctorAction(): Promise<void> {
	const cwd = process.cwd();
	const checks: CheckResult[] = [];

	// 1. Node version
	checks.push(checkNodeVersion());

	// 2. Config file presence + Zod validation
	const configPath = findAntiscaleConfigPath(cwd);
	if (!configPath) {
		checks.push({
			ok: false,
			label: "No antiscale.config.ts found",
			detail: "Run `antiscaler init` to create one.",
		});
	} else {
		checks.push({ ok: true, label: `Config found: ${path.basename(configPath)}` });

		let config: Awaited<ReturnType<typeof loadConfig>> | null = null;
		try {
			config = await loadConfig(cwd);
			checks.push({ ok: true, label: "Config is valid" });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			checks.push({
				ok: false,
				label: "Config validation failed",
				detail: msg,
			});
		}

		// 3. Cache size (only when config loaded successfully)
		if (config !== null) {
			checks.push(await checkCacheSize(cwd, config.cache.directory));

			// 4. Trace session check when lintOnly mode is configured
			//    (mirrors context.ts: needs both lintOnlyForNonCritical=true AND criticalPaths)
			const needsTrace =
				(config.performance?.lintOnlyForNonCritical ?? false) &&
				(config.performance?.criticalPaths?.length ?? 0) > 0;
			if (needsTrace) {
				const traceCheck = await checkTraces(cwd);
				if (!traceCheck.ok) {
					checks.push({
						...traceCheck,
						label: `performance.criticalPaths configured but ${traceCheck.label.toLowerCase()}`,
					});
				} else {
					checks.push(traceCheck);
				}
			}
		}
	}

	// Print all results
	let hasFailure = false;
	for (const c of checks) {
		console.log(`${icon(c)} ${c.label}`);
		if (c.detail) {
			console.log(`      → ${c.detail}`);
		}
		if (!c.ok && !c.warn) hasFailure = true;
	}

	if (hasFailure) process.exit(1);
}
