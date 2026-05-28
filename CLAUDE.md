# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # compile to dist/ via tsup
pnpm test           # vitest in watch mode
pnpm test:run       # vitest single-run (unit only)
pnpm test:integration  # integration tests only
pnpm test:all       # run all tests + coverage
pnpm lint           # biome check + tsc --noEmit
pnpm format         # biome format --write .
pnpm typecheck      # tsc --noEmit

# Run a single test file
pnpm vitest run src/core/graph/__tests__/dag.test.ts
```

Node ≥ 20 required; `pnpm` is the package manager.

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

3. **`core/graph/`** — `dag.ts` is the `TaskGraph` class (Kahn's algorithm for topological levels, cycle detection). `package-graph.ts` discovers workspace packages and auto-generates cross-package task entries. `planner.ts` wires config into a `TaskGraph`.

4. **`core/execution/`** — `runner.ts:runTasksWithDeps()` is the main execution loop: resolves DAG levels → `mapLimit` for concurrency within each level (or the event-driven `scheduler.ts` path when `useScheduler` is true) → calls `runOneTask` per task. `executor.ts` shells out via execa.

5. **`core/cache/`** — `hashing.ts` SHA-256s input globs (respecting `packageScopes`); `store.ts` reads/writes `.antiscale/cache/cache.json`; `git-diff.ts` narrows hashing to changed packages.

6. **`core/plugins/`** — `BuildPlugin` interface with four hooks: `onDetect`, `onHash`, `onBeforeExecute`, `onAfterExecute`. Framework adapters (`src/adapters/frameworks/`) are wrapped as plugins. `registry.ts` fans out hook calls.

7. **`core/scope/`** — `trace-loader.ts` reads recorded trace sessions; `critical-path.ts` checks whether changed files intersect declared critical routes, driving the `lintOnly` optimization.

8. **`core/semantic/`** — AST-based diff classifier using ts-morph (`non-impacting` / `internal` / `breaking`). Exists in core but not yet fully wired to CLI commands.

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

## Config file note

The config file is `antiscale.config.ts` (shorter `antiscale` name, not `antiscaler`). The cache directory is `.antiscale/cache/`. This naming discrepancy is intentional.
