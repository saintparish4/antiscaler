# Contributing to Antiscaler

## Dev Setup

```bash
git clone <repo-url>
cd antiscaler
pnpm install

# Run tests
pnpm test:run

# Type check
pnpm typecheck

# Format all files (writes in place)
pnpm format

# Check formatting without writing
pnpm format:check

# Lint (Biome check + type check)
pnpm lint

# Build all entry points
pnpm build

# Run the built CLI
node dist/cli.js --help
```

## Architecture Overview

```
src/
├── cli/                  # Commander-based CLI entry and commands
│   ├── index.ts          # Program definition, lazy command registration
│   ├── context.ts        # createContext() — DRY bootstrap for all commands
│   └── commands/         # One file per command (build, dev, run, init, etc.)
│
├── core/
│   ├── config/
│   │   ├── schema.ts     # Zod schema with defaults
│   │   └── loader.ts     # Finds and loads antiscale.config.ts via jiti
│   │
│   ├── graph/
│   │   ├── dag.ts        # TaskGraph class — addTask, addDependency, toLevels
│   │   ├── package-graph.ts  # Workspace discovery and cross-package task generation
│   │   └── planner.ts    # buildGraph() — config -> TaskGraph
│   │
│   ├── cache/
│   │   ├── hashing.ts    # SHA-256 content hashing via fast-glob + crypto
│   │   ├── store.ts      # Read/write JSON cache file
│   │   └── git-diff.ts   # Git-diff pre-filter for package scoping
│   │
│   ├── execution/
│   │   ├── executor.ts   # executeTask() — runs command via execa
│   │   ├── runner.ts     # runTasksWithDeps() — level-parallel DAG runner
│   │   └── scheduler.ts  # Event-driven scheduler (starts tasks as deps finish)
│   │
│   ├── detection/
│   │   ├── project.ts         # detectProject() — aggregates all detectors
│   │   ├── packageManager.ts  # npm / yarn / pnpm detection
│   │   ├── runtime.ts         # Node / Bun / Deno detection
│   │   └── framework.ts       # Next.js / Vite / generic detection
│   │
│   ├── insight/
│   │   ├── analyzer.ts   # computeInsights() — stats from results + cache
│   │   └── reporter.ts   # printInsights(), printEnv() — TTY-aware output
│   │
│   ├── plugins/
│   │   ├── types.ts      # BuildPlugin interface and hook signatures
│   │   └── registry.ts   # PluginRegistry — fans out hook calls
│   │
│   ├── scope/
│   │   ├── trace-loader.ts   # Reads recorded trace sessions
│   │   └── critical-path.ts  # Checks changed files against critical routes
│   │
│   ├── semantic/
│   │   └── differ.ts     # AST-based diff classifier via ts-morph
│   │
│   └── errors.ts         # AntiscaleError hierarchy (Config, Cycle, Task, Cache)
│
├── adapters/             # Concrete adapter implementations
│   ├── types.ts          # Adapter interfaces
│   ├── pm/               # npm.ts, yarn.ts, pnpm.ts
│   ├── runtimes/         # node.ts, bun.ts, deno.ts
│   └── frameworks/       # next.ts, vite.ts, generic.ts, plugin.ts
│
├── tracer/               # Module tracing plugins
│   ├── next-plugin.ts    # Webpack plugin for Next.js
│   ├── vite-plugin.ts    # Vite plugin
│   └── writer.ts         # Writes trace sessions to .antiscale/traces/
│
└── types/
    └── index.ts          # Shared type definitions (AntiscaleContext, TaskGraph, etc.)
```

### Key Design Decisions

- **Lazy imports**: The CLI entry (`index.ts`) defines commands with inline
  `action()` callbacks that use dynamic `import()`. This keeps
  `antiscaler --help` fast (< 100ms) by avoiding loading heavy deps (execa,
  jiti, fast-glob) until a command actually runs.
- **DI in the runner**: `runTasksWithDeps` accepts a `TaskExecutor` parameter
  (defaults to the real `executeTask`). Tests inject a mock executor.
- **Typed errors**: Every failure path throws an `AntiscaleError` subclass
  with a machine-readable `.code` string. The CLI error boundary formats
  these for the user.

## How to Add an Adapter

Example: adding support for a new package manager (say, `bun`).

1. Create `src/adapters/pm/bun.ts`:
   ```typescript
   import type { PackageManagerAdapter } from "../types.js";

   export const bunAdapter: PackageManagerAdapter = {
     name: "bun",
     lockfile: "bun.lockb",
     installCommand: "bun install",
     runCommand: (script) => `bun run ${script}`,
   };
   ```

2. Register it in `src/core/detection/packageManager.ts` — add the adapter
   to the detection list. The detector checks for the lockfile and returns
   the first match.

3. Add a test in `src/core/detection/__tests__/packageManager.test.ts`
   verifying that when `bun.lockb` exists, the bun adapter is returned.

## Testing Guide

Tests use Vitest. Files live next to the code they test inside `__tests__/`
directories.

```bash
# Run all tests once
pnpm test:run

# Run a specific test file
pnpm vitest run src/core/graph/__tests__/dag.test.ts

# Run integration tests only
pnpm test:integration

# Watch mode
pnpm test

# Run with coverage
pnpm test:all
```

### Test Categories

- **P0 (critical)**: DAG cycle detection, config loading with defaults,
  content hashing determinism
- **P1 (important)**: Cache hit/miss, runner level parallelism, task
  failure propagation, strict mode bypass

### Writing Tests

- Mock the `TaskExecutor` in runner tests (don't shell out in unit tests)
- Use `mkdtemp` for cache store tests that need filesystem
- Keep tests focused: one behavior per `it()` block

## Commit Messages

All commits must follow the conventional commit format:

```
<type>: <subject>

[optional body]

[optional footer]
```

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat: add critical-path route scoping to trace analyze` |
| `fix` | Bug fix | `fix: prevent cache miss when packageScopes is empty` |
| `perf` | Performance improvement | `perf: short-circuit DAG level computation on cache hit` |
| `refactor` | Code refactoring | `refactor: simplify createContext workspace wiring` |
| `test` | Test additions/changes | `test: add integration tests for pnpm workspace detection` |
| `docs` | Documentation | `docs: document scheduler policy options in README` |
| `chore` | Build/tooling changes | `chore: update biome to 2.x` |
| `types` | Type definition updates | `types: tighten AntiscaleContext packageScopes inference` |
| `ci` | CI/CD changes | `ci: add coverage threshold enforcement to CI workflow` |

**Subject line rules:** imperative mood, no trailing period, max 72 characters, capitalize first letter.

**Body:** wrap at 72 characters; explain what and why, not how; reference issue numbers when applicable.

## PR Requirements

All PRs must pass `pnpm format:check`, `pnpm lint` (Biome check + type check), and `pnpm build` before review. Run `pnpm format` locally to fix formatting before pushing.
