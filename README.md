# Antiscaler

[![npm version](https://img.shields.io/npm/v/antiscaler.svg)](https://www.npmjs.com/package/antiscaler)
[![CI](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml/badge.svg)](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml)

> **Beta software — use with caution in production.**
> Antiscaler is under active development. Public APIs and config shape may
> change between minor versions prior to a 1.0 release. It is suitable for
> experimentation and internal tooling, but we recommend pinning to an exact
> version and reviewing the [CHANGELOG](./CHANGELOG.md) before upgrading in
> any project you rely on.

Adaptive dev orchestration CLI that understands your project, builds a task
dependency graph, and executes only what's necessary using content-based
caching and runtime detection. Instead of locking you into one stack, Antiscaler
sits on top of whatever you already use and optimizes your dev loop.

---

## Features

**Active in the CLI today (0.2.x)**

- **Auto-detection** — Detects your package manager (npm / yarn / pnpm),
  runtime (Node / Bun / Deno), and framework (Next.js / Vite / generic).
- **Task DAG** — Declare `dependsOn` between tasks; Antiscaler resolves the
  dependency graph and runs each level in parallel.
- **Content hashing** — SHA-256 hashes of input globs; unchanged inputs
  produce a cache hit and skip execution entirely.
- **Workspace / PackageGraph** — Discovers workspace packages from
  `pnpm-workspace.yaml`, `package.json workspaces`, and tsconfig project
  references; auto-generates cross-package task entries. Enable via
  `workspace.enabled: true` in config.
- **Plugin interface** — `BuildPlugin` hooks (`onDetect`, `onHash`,
  `onBeforeExecute`, `onAfterExecute`) for extending task lifecycle.
  Framework adapters (Next.js, Vite, generic) are built on top of this.
- **Insight command** — Per-task timings, cache hit rates, and historical run
  data at a glance.
- **Works anywhere** — No monorepo tooling required. Drop a config file into
  any repo and go.

**Built, not yet CLI-surfaced (coming in a near-term patch)**

The following modules are fully implemented and tested but not yet wired
into the CLI execution path. They will be activated in an upcoming release:

- **Git-diff pre-filter** — Translates a `git diff` against a base ref into
  an affected-package set and skips tasks whose inputs haven't changed.
  Config key: `git.enabled` / `git.baseRef`.
- **Semantic diff** — AST-based change classifier (ts-morph) that
  distinguishes `non-impacting` (comments/whitespace) → `internal`
  (unexported logic) → `breaking` (public API) changes. Config key:
  `semanticDiff.enabled`.
- **Event-driven scheduler** — Fires tasks the moment their dependencies
  complete rather than waiting for a full DAG level to drain. Config key:
  `scheduler.policy`.

**Coming in future releases**

| Version | Phase | Highlights |
| ------- | ----- | ---------- |
| 0.3.0 | Runtime-driven builds | Consumer-side webpack/vite tracer that records which modules each route actually pulls in; `antiscaler build --scope=<session>` to build only what was touched at runtime. |
| 0.4.0 | PR-aware flows | Semantic conflict detection, PR diff scoping, GitHub Actions composite actions. |
| 0.5.0 | Self-organizing workspace | Auto-discovers and wires tasks across packages; dependency graph visualizer. |
| 0.6.0 | Cost-aware scheduling + remote cache | Edge-optimized task scheduling, remote shared cache, cost budgets. |

---

## Quick Start

```bash
# Install
npm install -D antiscaler

# Scaffold a config file
npx antiscaler init

# Run your build
npx antiscaler build

# Re-run — cached tasks are skipped
npx antiscaler build

# See timing and cache stats
npx antiscaler insight
```

---

## Configuration

Create `antiscale.config.ts` in your project root (or `.js` / `.mjs`):

```typescript
import { defineConfig } from "antiscaler";

export default defineConfig({
  strategy: "adaptive",       // "adaptive" (cache-aware) | "strict" (always run)
  cache: {
    mode: "content",
    directory: ".antiscale/cache",
  },
  tasks: {
    build: {
      command: "npm run build",
      inputs: ["src/**/*", "package.json"],
    },
    lint: {
      command: "npm run lint",
      inputs: ["src/**/*", ".eslintrc*"],
    },
    test: {
      command: "npm test",
      inputs: ["src/**/*", "tests/**/*"],
      dependsOn: ["build"],
    },
  },
});
```

### Config Reference

| Field                    | Type                                                        | Default               | Description                                              |
| ------------------------ | ----------------------------------------------------------- | --------------------- | -------------------------------------------------------- |
| `strategy`               | `"adaptive" \| "strict"`                                    | `"adaptive"`          | Cache behavior                                           |
| `cache.mode`             | `"content"`                                                 | `"content"`           | Hashing mode (content-based)                             |
| `cache.directory`        | `string`                                                    | `".antiscale/cache"`  | Where cache files are stored                             |
| `tasks`                  | `Record<string, TaskConfig>`                                | `{}`                  | Named tasks                                              |
| `tasks.*.command`        | `string`                                                    | `<pm> run <taskName>` | Shell command to execute                                 |
| `tasks.*.inputs`         | `string[]`                                                  | `[]`                  | Glob patterns for cache hashing                          |
| `tasks.*.dependsOn`      | `string[]`                                                  | `[]`                  | Tasks that must run first                                |
| `workspace.enabled`      | `boolean`                                                   | `false`               | Enable workspace / PackageGraph discovery                |
| `workspace.scripts`      | `string[]`                                                  | `["build","test","lint"]` | Scripts to auto-generate cross-package tasks for     |
| `git.enabled`            | `boolean`                                                   | `true`                 | *(not yet active)* Git-diff pre-filter                  |
| `git.baseRef`            | `string`                                                    | `"HEAD~1"`            | *(not yet active)* Base ref for diff                     |
| `semanticDiff.enabled`   | `boolean`                                                   | `false`               | *(not yet active)* AST-based change classifier           |
| `scheduler.policy`       | `"auto" \| "light-first" \| "pack-heavy" \| "critical-path"`| `"auto"`             | *(not yet active)* Task scheduling policy                |

> Note: the config filename (`antiscale.config.ts`) and cache directory
> (`.antiscale/cache`) are internal conventions and intentionally retain the
> shorter `antiscale` name for brevity on disk.

---

## CLI Reference

```
antiscaler <command> [options]

Commands:
  build          Run the build task through the DAG
  dev            Start the dev server (framework-aware)
  run <task>     Run any named task
  init           Scaffold antiscale.config.ts
  insight        Show timing and cache hit stats
  env            Show detected runtime, PM, and framework
  check          Validate config and DAG (no execution)

Options:
      -V, --version       Show version
      -h, --help          Show help
      -c, --concurrency   Max tasks per DAG level (default: cpus - 1)
                          Available on `build`, `dev`, and `run`.
```

---

## How It Works

1. **Load config** — Reads `antiscale.config.ts` via jiti (TypeScript support
   without a build step).
2. **Detect environment** — Identifies package manager, runtime, and framework
   from lockfiles and process globals.
3. **Build DAG** — Constructs a directed acyclic graph from `dependsOn`
   declarations; validates no cycles exist.
4. **Resolve levels** — Topological sort produces execution levels; tasks in
   the same level run concurrently via `Promise.all`.
5. **Hash & cache** — Each task's input globs are SHA-256 hashed. If the hash
   matches the cached hash, execution is skipped.
6. **Execute** — Cache misses run the task command via `execa` with inherited
   stdio.
7. **Report** — After execution, prints a table of task names, durations, and
   cache hit/miss status.

---

## Versioning & Stability

Antiscaler follows [SemVer](https://semver.org) with the following intent:

- **PATCH** (`0.x.y`) — bug fixes only; safe to update.
- **MINOR** (`0.x.0`) — additive features; review the CHANGELOG before
  upgrading.
- **MAJOR** (`1.0.0`) — first stable, API-frozen release. Until then, minor
  bumps may include breaking changes to config shape or CLI flags.

Pre-release builds (e.g. `0.4.0-next.1`) are published under the `next`
dist-tag for opt-in testing:

```bash
npm install -D antiscaler@next
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All PRs must pass `pnpm lint` (type
check + tests) and `pnpm build` before review.

---

## License

MIT — see [LICENSE](./LICENSE).
