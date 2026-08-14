# Project Instructions

A general guide for working in a codebase. Fill in **Stack** and **Commands** per project. The rest applies unless the project explicitly overrides it.

## Stack

`antiscaler` — an adaptive dev orchestration CLI (task DAG, content caching, runtime detection).

- **Language**: TypeScript, ESM only (`"type": "module"`). Node ≥ 20, pnpm ≥ 10.
- **Build**: tsup — three entry points: `src/index.ts` (library), `src/cli/index.ts` (`antiscaler` binary), `src/tracer/index.ts` (webpack/Vite tracer plugins).
- **CLI**: Commander.js.
- **Key libraries**: zod (config schema and defaults), jiti (loads `antiscale.config.ts` with no build step), execa (process execution), fast-glob (input hashing), ts-morph (semantic change analysis), picocolors, string-argv.
- **Tooling**: Biome (format + lint + import organization), Vitest with v8 coverage, TypeScript (`tsc --noEmit`).

Note: the config file is `antiscale.config.ts` and the cache directory is `.antiscale/` — the shorter `antiscale` name, not `antiscaler`. This discrepancy is intentional.

## Architecture

Layered, with dependencies pointing one way: `cli → core → adapters`. Interfaces (ports) are owned by `core`; adapters implement them and import nothing from `core` except types.

- `src/cli/` — Commander wiring, option parsing, terminal rendering. The user-facing surface.
- `src/core/` — orchestration logic, grouped by capability (`cache`, `graph`, `execution`, `semantic`, `scope`, `detection`, `plugins`, `history`, `insight`) rather than by technical kind. No `utils/`, `helpers/`, or `services/` buckets.
- `src/adapters/` — the outside world: `pm/` (npm/pnpm/yarn command builders), `runtimes/` (Node/Bun/Deno detection), `frameworks/` (Next.js/Vite/generic, each wrapped as a plugin via `wrapFrameworkAsPlugin`). One file per implementation.
- `src/tracer/` — separate `tsup` entry point; webpack (`next-plugin.ts`) and Vite (`vite-plugin.ts`) plugins that intercept module resolution and write session JSON to `.antiscale/traces/`.
- `src/types/` — contracts shared across layers.

Rules:

- Business logic must not live in command handlers. A command parses options, calls `createContext()`, delegates to `core`, and renders the result. A command file growing branches and conditionals means the logic belongs in `core`.
- `core` must not print or exit. It reports through the progress/reporter interface and throws typed errors from `core/errors.ts` (`AntiscaleError` subclasses with a machine-readable `.code` and a user-facing `.hint`); only the CLI top level catches `AntiscaleError` → exit 1, unexpected errors → exit 2.
- Side effects live at the edges and arrive through injectable interfaces — `runTasksWithDeps` takes a `TaskExecutor`, defaulting to the real one. This is what keeps the suite unit-heavy: unit tests never shell out.
- Config is loaded once, at one wiring point (`cli/context.ts:createContext()`), which also detects PM/runtime/framework, builds the task DAG, and computes the git-diff `packageScopes`/`affectedPackages` pre-filter. Modules receive what they need instead of re-reading config themselves.
- `src/cli/index.ts` registers commands with a dynamic `import()` inside each `action()` callback, deferring heavy deps (execa, jiti, fast-glob) until a command actually runs — this is what keeps `antiscaler --help` fast. It's a sanctioned exception to "prefer top-level imports"; don't add new lazy imports elsewhere without the same justification.
- A new capability is a new directory under `core/` plus a thin command — not another branch inside an existing module.

### Core pipeline

The request path most commands follow: `createContext()` → `core/graph` builds the `TaskGraph` (Kahn's algorithm, cycle detection) → `core/execution:runTasksWithDeps()` resolves DAG levels and runs each task (concurrency-limited, or via the event-driven `scheduler.ts` when `useScheduler` is set) → `core/cache` hashes inputs and reads/writes `.antiscale/cache/cache.json`, narrowed by `core/cache/git-diff.ts` to changed packages. `core/plugins` fans out `onDetect`/`onHash`/`onBeforeExecute`/`onAfterExecute` hooks to registered `BuildPlugin`s (framework adapters are wrapped as plugins). `core/scope` and `core/semantic` (ts-morph-based signature/body diffing, symbol graph, blast-radius, test-impact selection) drive change-intelligence features (`antiscaler diff`, `pr check`, `antiscaler impact`); predictions are logged to `.antiscale/history/impact.jsonl` for shadow-mode validation before test skipping is ever enabled.

## Code Style

- Follow the project's formatter and existing conventions. Do not invent a parallel style.
- Prefer named exports.
- Avoid `any`, non-null assertions (`!`), and other untyped escape hatches; Biome blocks the first two. A `biome-ignore` needs a reason and should be rare.
- Semicolons, quotes, and similar punctuation follow the language and the formatter. This project uses tabs and double quotes for TS/JS, 2-space for JSON (Biome-enforced).
- Use the `node:` protocol for Node built-ins, `import type` for type-only imports, and `import * as z from "zod"` (never `import { z }`) — all Biome-enforced.
- Use `Uint8Array` instead of `Buffer` (Biome blocks `Buffer` in `src/`).
- Prefer optional chaining/nullish coalescing and early returns over deep nesting; combine conditions in one `if` rather than nesting them.
- Avoid shortening variable names (`packageScopes`, not `pkgScopes`).

## Testing

Three tiers, each answering a different question. Write the test at the cheapest tier that can answer yours.

| Tier | Tests | Lives in | Runs against |
|------|-------|----------|--------------|
| Unit | Isolated behavior — one module, collaborators substituted | `src/**/__tests__/*.test.ts`, beside its source | Source |
| Integration | Boundaries — real modules meeting each other, or a real edge (filesystem, git, config loading) | `src/__tests__/integration/*.integration.test.ts` | Source |
| E2E | User workflows — the shipped binary doing what someone asked it to do | `src/__tests__/e2e/*.e2e.test.ts` | Built `dist/` |

- **Unit tests isolate.** Inject at the seams the architecture already provides — `runTasksWithDeps` takes a `TaskExecutor`; pass a mock. Never shell out, never touch the network, never depend on the surrounding repo's git state. A test that needs a fixture workspace to say anything true is not a unit test.
- **Integration tests exercise boundaries.** The contract between two real collaborators: does the config loader hand the planner something the planner accepts, does the cache store survive a round-trip through a real filesystem, does `git-diff.ts` read a real repo correctly. Assert on the seam — not on terminal output, which belongs to E2E.
- **E2E tests describe workflows in the user's words.** "A fresh build runs every task in dependency order." "A second run hits the cache." "Changing `utils` rebuilds `web` but skips `docs`." They spawn `dist/cli.js` against a fixture workspace and assert on exit codes and stdout, so they need `pnpm build` first. Keep this tier small — it is the slowest and most brittle; add to it only for a workflow a user would notice breaking.
- Fixture workspaces are shared across tiers at `src/__tests__/fixtures/`.
- New business logic requires tests. A bug fix requires a test that fails before it.
- Name tests for the behavior they document (`test_cache_hit`, `test_cache_miss`, `test_incremental_invalidation`), not for the function they call.
- Use the project's test runner — Vitest projects `unit`, `integration`, `e2e`. Do not introduce another without justification.
- This repo skews heavily unit-first by design; dependency injection is what makes that possible, so reach for a slower tier only when the question genuinely lives at a boundary or in a workflow.
- Coverage targets enforced in CI: 70% lines/statements/functions, 60% branches.
- Read and copy the style of similar existing tests when adding new cases.

## Commands

```bash
pnpm build             # compile to dist/ via tsup
pnpm clean             # delete dist/
pnpm test              # vitest in watch mode
pnpm test:run          # vitest single-run
pnpm test:integration  # integration project only (boundaries)
pnpm test:e2e          # e2e project only — requires pnpm build first
pnpm test:all          # all tests + coverage
pnpm format            # biome format --write .
pnpm format:check      # biome format (read-only)
pnpm lint              # biome check . (static analysis, read-only)
pnpm typecheck         # tsc --noEmit
pnpm check             # biome check --write (local autofix: format + lint + organize imports)
pnpm bench             # benchmark suite (--quick via pnpm bench:quick)

# Run a single test file
pnpm vitest run src/core/graph/__tests__/dag.test.ts

# Test the built CLI
node dist/cli.js --help
```

See `CONTRIBUTING.md` for full dev-setup steps. Prefer running a single test file (as above) over the full suite while iterating. Never run a blanket `pnpm update` — bump one package at a time so lockfile diffs stay reviewable. Cross-platform correctness is CI's job (`ubuntu`/`windows`/`macos` × Node 20/22/24 in `.github/workflows/ci.yml`), not a local cross-compile step — prefer `node:path` helpers over manual string splitting so the matrix actually catches regressions.

All PRs must pass `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. The default branch is `alpha`, which is expected to be lint-clean — a warning there is from your change, not pre-existing. Commits follow conventional commits: `<type>: <subject>`, imperative mood, ≤ 72 chars, no trailing period.

The `.husky/pre-commit` hook gates every commit through `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test:run`, in that order; a failure at any step blocks the commit before the next step runs.

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

## Rules

- Do not introduce dependencies without justification.
- Do not modify the database schema without a migration.
- Do not expose secrets.
- Make the code obvious: good names, clear control flow, small functions, strong types, clear abstractions, tests.
- Use tests to document behavior (`test_cache_hit`, `test_cache_miss`, `test_incremental_invalidation`).
- Use documentation for system-level concepts (`docs/architecture.md`, `docs/incremental-computation.md`).

### Comments

Do not narrate the implementation. Do not add comments that restate what the code does. Do not generate comments for every function, variable, loop, or block. Do not add comments solely to make generated code appear documented. When reviewing AI-generated code, delete unnecessary comments rather than keeping them because they look helpful.

Comments must explain **why**, not **what**, unless the what is genuinely difficult to understand.

Only add comments when they explain:

- Why a decision was made, or why something is implemented a certain way
- Non-obvious constraints, invariants, or design decisions
- Algorithmic reasoning
- Performance considerations
- Safety requirements
- External or system constraints
- Compatibility requirements or workarounds
- Important architectural decisions
- Behavior that would otherwise be surprising
