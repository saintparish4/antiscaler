# Antiscaler

[![npm version](https://img.shields.io/npm/v/antiscaler.svg)](https://www.npmjs.com/package/antiscaler)
[![CI](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml/badge.svg)](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml)

> **Stable — v1.0.** The public API (everything exported from `antiscaler` and `antiscaler/tracer`) follows [semantic versioning](https://semver.org): no breaking changes in minor or patch releases. Review the [CHANGELOG](./CHANGELOG.md) before upgrading.

Antiscaler is a build orchestrator that skips work you haven't changed. Drop a config file into any repo, declare your tasks and their inputs, and Antiscaler handles dependency ordering, content-based caching, and workspace scoping — without replacing your existing scripts.

On the second run, unchanged tasks finish in milliseconds. In a CI environment with a shared remote cache, the second run can be just as fast as the first was locally.

---

## Install

```bash
npm install -D antiscaler
# or
pnpm add -D antiscaler
# or
yarn add -D antiscaler
```

Node ≥ 20 required.

---

## Quick start

```bash
# Scaffold a config (interactive)
npx antiscaler init

# Run your build (first run hashes inputs)
npx antiscaler build

# Run again — unchanged tasks are skipped
npx antiscaler build

# Check timing and cache stats
npx antiscaler insight
```

After `init`, open `antiscale.config.ts` and add your tasks (see [Getting started](./docs/getting-started.md)).

---

## Minimal config

```typescript
import { defineConfig } from "antiscaler";

export default defineConfig({
  tasks: {
    typecheck: {
      command: "tsc --noEmit",
      inputs: ["src/**/*", "tsconfig.json"],
    },
    build: {
      command: "npm run build",
      inputs: ["src/**/*", "package.json"],
      dependsOn: ["typecheck"],
    },
    test: {
      command: "npm test",
      inputs: ["src/**/*", "tests/**/*"],
      dependsOn: ["build"],
    },
  },
});
```

`dependsOn` sets execution order. Tasks in the same level run in parallel.

---

## Features

| Feature | What it does |
|---------|-------------|
| **Content caching** | SHA-256 hashes input globs; skips tasks whose inputs haven't changed |
| **Task DAG** | `dependsOn` builds a dependency graph; each level runs concurrently |
| **Git-diff scoping** | Narrows hashing to changed packages, so untouched workspace packages always cache-hit |
| **Workspace support** | Auto-discovers pnpm/npm/yarn workspace packages and generates cross-package tasks |
| **`--affected` flag** | Runs only tasks whose package (or dependents) changed in the current branch |
| **Remote cache** | Shares the cache across machines via HTTP or S3 — CI ↔ local, run A ↔ run B |
| **Lint-only fast path** | Skips builds entirely when no critical route is touched (Next.js / Vite with tracer) |
| **PR commands** | `pr check` classifies changed TypeScript semantically; `pr replay` intersects changes with recorded traces |
| **Impact prediction** | `impact` classifies each change at the symbol level (signature vs. body vs. comment-only), traces the blast radius through a file-level import graph, and predicts which test files must run — report-only, with a confidence score |
| **Workspace dependency check** | `workspace check` fails CI when a package imports a workspace sibling or external package it doesn't declare, or reaches into a sibling via a relative path |
| **Event-driven scheduler** | Starts tasks the moment their dependencies finish instead of waiting for full DAG waves |
| **Auto-detection** | Detects your package manager, runtime, and framework from lockfiles and project files |
| **Doctor** | `antiscaler doctor` validates your config, checks Node version, and warns about cache size |

---

## Performance

Measured on a real Next.js 16 / Turbopack app (32 routes, TypeScript, Windows i9):

| Scenario | Time |
|----------|------|
| Cold run — no cache, full Next.js build | ~41–49 s |
| Warm run — inputs unchanged, task skipped | 0 ms |

The warm run is not "fast" — it is **zero**. Antiscaler hashes inputs, finds a match, and exits without spawning the build process at all. The only overhead on a cache hit is the hash computation and a single `cache.json` read, which is sub-millisecond.

CLI startup overhead (e.g. `antiscaler --help`) is consistently under 200 ms regardless of project size.

> Cold-run time reflects your build tool, not Antiscaler. Run `antiscaler insight` after a few builds to see per-task timings for your own project.

---

## CLI reference

```
antiscaler <command> [options]

Commands:
  init                       Scaffold antiscale.config.ts (interactive)
  build [--affected]         Run the build task through the DAG
  dev                        Start the dev server (framework-aware)
  run <task>                 Run any named task
  trace                      Run dev with module tracing enabled
  trace analyze [sessionId]  Inspect a recorded trace session
  insight                    Show per-task timings and cache hit rates
  env                        Show detected runtime, PM, and framework
  check                      Validate config and DAG without executing
  doctor                     Health-check your environment and config
  diff <file> [--base <ref>] Classify a single file change as non-impacting/internal/breaking
  impact [--base <ref>]      Predict which tests a change requires (report-only; --json for CI)
  workspace check [--json]   Detect undeclared dependencies — exits 1 on violations (CI gate)
  pr check [--base <ref>]    Classify changed TypeScript files semantically
  pr replay [--base <ref>]   Intersect PR changes with the last trace session
  pr report [--base <ref>]   Combined JSON/Markdown report of check + replay

Global options:
  -V, --version              Show version
  -h, --help                 Show help
  -c, --concurrency <n>      Max parallel tasks per DAG level (build/dev/run)
```

---

## Documentation

| Guide | Contents |
|-------|----------|
| [Getting started](./docs/getting-started.md) | Single-repo setup from scratch, first cache hit |
| [Monorepo](./docs/monorepo.md) | pnpm workspace setup, `--affected`, cascade scoping |
| [Next.js](./docs/nextjs.md) | Tracer plugin, lint-only fast path |
| [Vite](./docs/vite.md) | Vite plugin setup |
| [PR commands](./docs/pr-commands.md) | `pr check`, `pr replay`, `pr report`, GitHub Actions |
| [Remote cache](./docs/remote-cache.md) | HTTP and S3 backend setup |
| [Config reference](./docs/config-reference.md) | Every config key, type, default, and example |
| [Troubleshooting](./docs/troubleshooting.md) | Top 10 problems and fixes |

---

## Contributing

```bash
pnpm check          # format + lint + organize imports (writes in place) — use locally
pnpm lint           # format + lint + typecheck, no writes — mirrors CI
pnpm build          # compile to dist/
pnpm test:run       # unit tests (no build required)
pnpm test:integration  # integration tests (requires dist/ — run pnpm build first)
pnpm test:all       # all tests + coverage
```

All PRs must pass `pnpm lint` and `pnpm build` before review. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

---

## License

MIT — see [LICENSE](./LICENSE).
