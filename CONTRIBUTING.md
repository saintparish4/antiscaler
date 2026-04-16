# Contributing to Antiscale

## Dev Setup

```bash
git clone <repo-url>
cd antiscale
npm install

# Run tests
npx vitest run

# Type check
npx tsc --noEmit

# Build CLI
npx tsup src/cli/index.ts --format esm --dts

# Run built CLI
node dist/index.js --help
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
│   │   └── plannet.ts    # buildGraph() — config -> TaskGraph
│   │
│   ├── cache/
│   │   ├── hashing.ts    # SHA-256 content hashing via fast-glob + crypto
│   │   └── store.ts      # Read/write JSON cache file
│   │
│   ├── execution/
│   │   ├── executor.ts   # executeTask() — runs command via execa
│   │   └── runner.ts     # runTasksWithDeps() — level-parallel DAG runner
│   │
│   ├── detection/
│   │   ├── project.ts    # detectProject() — aggregates all detectors
│   │   ├── packageManager.ts  # npm / yarn / pnpm detection
│   │   ├── runtime.ts         # Node / Bun / Deno detection
│   │   └── framework.ts       # Next.js / Vite / generic detection
│   │
│   ├── insight/
│   │   ├── analyzer.ts   # computeInsights() — stats from results + cache
│   │   └── reporter.ts   # printInsights(), printEnv() — TTY-aware output
│   │
│   └── errors.ts         # AntiscaleError hierarchy (Config, Cycle, Task, Cache)
│
├── adapters/             # Concrete adapter implementations
│   ├── types.ts          # Adapter interfaces
│   ├── pm/               # npm.ts, yarn.ts, pnpm.ts
│   ├── runtimes/         # node.ts, bun.ts, deno.ts
│   └── frameworks/       # next.ts, vite.ts, generic.ts
│
└── types/
    └── index.ts          # Shared type definitions
```

### Key Design Decisions

- **Lazy imports**: The CLI entry (`index.ts`) defines commands with inline
  `action()` callbacks that use dynamic `import()`. This keeps
  `antiscale --help` fast (< 100ms) by avoiding loading heavy deps (execa,
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

3. Add a test in the detection test file verifying that when `bun.lockb`
   exists, the bun adapter is returned.

## Testing Guide

Tests use Vitest. Files live next to the code they test inside `__tests__/`
directories.

```bash
# Run all tests
npx vitest run

# Run a specific test file
npx vitest run src/core/graph/__tests__/dag.test.ts

# Watch mode
npx vitest
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
