# Antiscaler

[![npm version](https://img.shields.io/npm/v/antiscaler.svg)](https://www.npmjs.com/package/antiscaler)
[![CI](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml/badge.svg)](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml)

> **Beta software.** APIs and config shape may change between minor versions before 1.0. Pin to an exact version and review the [CHANGELOG](./CHANGELOG.md) before upgrading.

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
| **Event-driven scheduler** | Starts tasks the moment their dependencies finish instead of waiting for full DAG waves |
| **Auto-detection** | Detects your package manager, runtime, and framework from lockfiles and project files |
| **Doctor** | `antiscaler doctor` validates your config, checks Node version, and warns about cache size |

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

All PRs must pass `pnpm lint` (Biome check + type check) and `pnpm build` before review. See the commit history for style guidance.

---

## License

MIT — see [LICENSE](./LICENSE).
