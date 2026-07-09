# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # compile to dist/ via tsup
pnpm clean          # delete dist/
pnpm test           # vitest in watch mode
pnpm test:run       # vitest single-run (unit only)
pnpm test:integration  # integration tests only
pnpm test:all       # run all tests + coverage
pnpm check          # biome check --write (format + lint + organize imports)
pnpm lint           # biome check (read-only) + tsc --noEmit — used in CI
pnpm format         # biome format --write .
pnpm format:check   # biome format (read-only)
pnpm typecheck      # tsc --noEmit

# Run a single test file
pnpm vitest run src/core/graph/__tests__/dag.test.ts

# Test the built CLI
node dist/cli.js --help
```

Node ≥ 20, pnpm ≥ 10 required.

## Architecture

### Entry points (tsup builds three)

| Export | Source | Purpose |
|--------|--------|---------|
| `dist/index.js` | `src/index.ts` | Public library API — re-exports `defineConfig` and types |
| `dist/cli.js` | `src/cli/index.ts` | `antiscaler` binary (Commander.js, lazy-imports each command) |
| `dist/tracer.js` | `src/tracer/index.ts` | Next.js / Vite webpack/Vite plugins for module tracing |

### Core pipeline (`src/core/`)

The central request path for every CLI command is:

1. **`cli/context.ts:createContext()`** — builds `AntiscaleContext`. This is the single wiring point: loads config (via jiti), detects PM/runtime/framework, builds the task DAG, optionally loads the workspace PackageGraph, runs the git-diff pre-filter to compute `packageScopes`, and evaluates the `lintOnly` flag. Every command calls this once then passes it to `toRunOptions()`.

2. **`core/config/`** — `loader.ts` uses jiti to load `antiscale.config.ts` without a build step; `schema.ts` holds the Zod schema with all defaults. The schema drives both validation and the `AntiscaleConfig`/`ResolvedAntiscaleConfig` types in `src/types/index.ts`.

3. **`core/graph/`** — `dag.ts` is the `TaskGraph` class (Kahn's algorithm for topological levels, cycle detection). `package-graph.ts` discovers workspace packages and auto-generates cross-package task entries. `planner.ts` wires config into a `TaskGraph`. `import-graph.ts` is the file-level reverse import graph (`Map<file, dependents[]>` plus `computeAffectedFiles` BFS), derived on demand from the persisted SymbolGraph — not persisted itself, since derivation is cheap string work. `workspace-check.ts` compares actual imports against declared manifest dependencies (surfaced as `antiscaler workspace check`, a CI gate that exits 1 on violations).

4. **`core/execution/`** — `runner.ts:runTasksWithDeps()` is the main execution loop: resolves DAG levels → `mapLimit` for concurrency within each level (or the event-driven `scheduler.ts` path when `useScheduler` is true) → calls `runOneTask` per task. `executor.ts` shells out via execa.

5. **`core/cache/`** — `hashing.ts` SHA-256s input globs (respecting `packageScopes`); `store.ts` reads/writes `.antiscale/cache/cache.json`; `git-diff.ts` narrows hashing to changed packages.

6. **`core/plugins/`** — `BuildPlugin` interface with four hooks: `onDetect`, `onHash`, `onBeforeExecute`, `onAfterExecute`. Framework adapters (`src/adapters/frameworks/`) are wrapped as plugins. `registry.ts` fans out hook calls.

7. **`core/scope/`** — `trace-loader.ts` reads recorded trace sessions; `critical-path.ts` checks whether changed files intersect declared critical routes, driving the `lintOnly` optimization.

8. **`core/semantic/`** — ts-morph–based change intelligence. `surface.ts` extracts each file's exported surface (signature vs. body per symbol); `differ.ts` classifies changes (`non-impacting` / `internal` / `breaking`) with per-symbol `changeKind` and a confidence score; `symbol-graph.ts` is the persisted, incrementally-updated symbol index (`.antiscale/graph/symbols.json`) recording imports, exports, and signature/body hashes per file; `blast-radius.ts` traces `File → Import → Package → Task` — differ-gated seeds, symbol-gated first hop, structural BFS beyond it, with an aggregate confidence score; `test-impact.ts` builds `TestTrace` (test → import closure) / `CoverageMap` (source → tests) and selects affected tests — behavior-conservative (body-only edits still select importers' tests; only `non-impacting` changes select zero) with select-all on config changes. The differ is wired into `diff` and `pr check`; the full pipeline is surfaced by `antiscaler impact` (`cli/commands/impact.ts`) — report-only, reusing the `pr check` verdict vocabulary, logging every prediction to `.antiscale/history/impact.jsonl` (`core/history/impact-log.ts`) for shadow-mode validation before test skipping is ever enabled.

### Adapters (`src/adapters/`)

- `frameworks/` — Next.js, Vite, and generic adapters implementing `FrameworkAdapter`; each is registered as a plugin via `wrapFrameworkAsPlugin`.
- `pm/` — npm, pnpm, yarn command builders.
- `runtimes/` — Node, Bun, Deno detection.

### Tracer (`src/tracer/`)

Webpack (`next-plugin.ts`) and Vite (`vite-plugin.ts`) plugins that intercept module resolution during builds/dev runs and write session JSON to `.antiscale/traces/`. `writer.ts` handles the file writes.

### Tests

- Unit tests: `src/**/__tests__/*.test.ts` (co-located with source)
- Integration tests: `src/__tests__/integration/*.integration.test.ts` with fixture workspaces under `src/__tests__/integration/fixtures/`
- Coverage targets: 70% lines/statements, 64% functions, 60% branches (enforced in CI)

## Code conventions

**Imports**
- Always use `node:` protocol for Node built-ins (`node:fs`, `node:path`, etc.)
- Use `import type` for type-only imports (Biome enforces `useImportType`)
- `import * as z from "zod"` — never `import { z } from "zod"`

**Types**
- Use `Uint8Array` instead of `Buffer` (Biome blocks `Buffer` in `src/`)
- Prefer `Uint8Array` and web-platform types

**Formatting**
- Tabs for TypeScript/JavaScript, 2-space for JSON (enforced by Biome)
- Double quotes for JS strings

**Errors**
- Throw typed errors from `src/core/errors.ts` (`AntiscaleError`, `ConfigError`, `CycleError`). The CLI top-level catches `AntiscaleError` and exits with code 1; unexpected errors exit with code 2.

## Key design decisions

- **Lazy CLI imports**: `src/cli/index.ts` registers commands with dynamic `import()` in `action()` callbacks. This keeps `antiscaler --help` under 200 ms by deferring heavy deps (execa, jiti, fast-glob) until a command actually runs.
- **DI in runner**: `runTasksWithDeps` accepts a `TaskExecutor` parameter (defaults to the real `executeTask`). Tests inject a mock — never shell out in unit tests.
- **Typed errors**: Every failure throws an `AntiscaleError` subclass with a machine-readable `.code` string. The CLI top-level catches `AntiscaleError` → exit 1; unexpected errors → exit 2.

## Commit messages

Follow conventional commits: `<type>: <subject>` (imperative mood, ≤ 72 chars, no trailing period).

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code refactoring |
| `test` | Test additions/changes |
| `docs` | Documentation |
| `chore` | Build/tooling changes |
| `types` | Type definition updates |
| `ci` | CI/CD changes |

## PR requirements

All PRs must pass `pnpm lint` and `pnpm build` before review. `pnpm lint` runs `biome check` (which covers both linting and formatting) plus `tsc --noEmit` — running `pnpm format:check` separately is redundant. Run `pnpm format` locally to fix formatting before pushing. The default branch is `alpha`.

## Config file note

The config file is `antiscale.config.ts` (shorter `antiscale` name, not `antiscaler`). The cache directory is `.antiscale/cache/`. This naming discrepancy is intentional.
