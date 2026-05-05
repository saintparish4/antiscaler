# Antiscaler

[![npm version](https://img.shields.io/npm/v/antiscaler.svg)](https://www.npmjs.com/package/antiscaler)
[![CI](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml/badge.svg)](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml)

> **Beta software — use with caution in production.**
> Antiscaler is under active development. Public APIs and config shape may
> change between minor versions prior to a 1.0 release. It is suitable for
> experimentation and internal tooling, but we recommend pinning to an exact
> version and reviewing the [CHANGELOG](./CHANGELOG.md) before upgrading in
> any project you rely on.

Adaptive dev orchestration CLI that detects your environment, builds a task
dependency graph, and skips unchanged work with content-based caching.
Antiscaler sits on top of your existing stack and optimizes your dev loop
without forcing a framework migration.

---

## Features

**Active in the CLI today (0.3.0)**

- **Auto-detection** — Detects your package manager (npm / yarn / pnpm),
  runtime (Node / Bun / Deno), and framework (Next.js / Vite / generic).
- **Task DAG** — Declare `dependsOn` between tasks; Antiscaler resolves the
  dependency graph and runs each level in parallel.
- **Content hashing** — SHA-256 hashes of input globs; unchanged inputs
  produce a cache hit and skip execution entirely.
- **Git-diff pre-filter** — Uses `git diff` (configurable base ref) to narrow
  hashing to affected workspace packages before execution.
- **Workspace / PackageGraph** — Discovers workspace packages from
  `pnpm-workspace.yaml`, `package.json workspaces`, and tsconfig project
  references; auto-generates cross-package task entries. Enable via
  `workspace.enabled: true` in config.
- **Event-driven scheduler** — Optional scheduler policy (`auto`,
  `light-first`, `pack-heavy`, `critical-path`) starts tasks as soon as deps
  are satisfied, instead of waiting for full DAG waves.
- **Plugin interface** — `BuildPlugin` hooks (`onDetect`, `onHash`,
  `onBeforeExecute`, `onAfterExecute`) for extending task lifecycle.
  Framework adapters (Next.js, Vite, generic) are built on top of this.
- **Insight command** — Per-task timings, cache hit rates, and historical run
  data at a glance.
- **Works anywhere** — No monorepo tooling required. Drop a config file into
  any repo and go.

**In codebase but not fully CLI-activated yet**

- **Semantic diff classifier** — AST-based `non-impacting` / `internal` /
  `breaking` classifier (`ts-morph`) exists in core and tests, with broader
  PR-aware CLI integration planned in the next phase.

**Roadmap (implementation phases)**

| Status | Target Version | Phase | Highlights |
| ------ | -------------- | ----- | ---------- |
| Current | 0.3.x | Phase 0 (core plumbing) | DAG + content cache, workspace PackageGraph, git-diff pre-filter, event-driven scheduler, plugin registry, insight reporting. |
| Planned | 0.4.0 | Phase 1 (runtime-driven builds) | Runtime tracer entrypoint, trace-scoped build execution, performance-guided invalidation. |
| Planned | 0.5.0 | Phase 2 (PR-aware flows) | Semantic conflict detection, PR replay/check/report commands, GitHub Actions reporting. |
| Planned | 0.6.0 | Phase 3 (workspace intelligence) | Import graph analysis, layout suggestions, auto-injected build dependencies, workspace commands/bot integration. |
| Planned | 0.7.0 | Phase 4 (cost-aware scheduling + remote cache) | Cost model, advanced scheduling policies, route-scoped Next.js builds, remote semantic-aware cache. |

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
| `git.enabled`            | `boolean`                                                   | `true`                 | Enable/disable git-diff pre-filter for package scoping  |
| `git.baseRef`            | `string`                                                    | `"HEAD~1"`            | Base ref used by git-diff pre-filter                     |
| `semanticDiff.enabled`   | `boolean`                                                   | `false`               | Enable semantic diff hooks (currently partial/experimental wiring) |
| `scheduler.policy`       | `"auto" \| "light-first" \| "pack-heavy" \| "critical-path"`| `"auto"`             | Scheduler policy for event-driven execution              |

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
