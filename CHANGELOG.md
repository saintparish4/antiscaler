# Changelog

All notable changes to antiscaler are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-05-21

### Added

- `antiscaler trace analyze [sessionId]` subcommand — prints modules, routes,
  and per-package module counts from a recorded trace session.
- Route detection in the Next.js webpack plugin: derives page routes from
  webpack entrypoints/chunkGraph, with a `deriveRoutesFromFiles` fallback that
  correctly handles both pages-router and app-router layouts.
- Route detection in the Vite plugin via the `generateBundle` hook; entry
  chunks are mapped to URL paths using the same derivation logic.
- `getDependencies(task)` method on `TaskGraph` — exposes real DAG edges for
  external consumers and for the scheduler's dependency walk.
- `taskFilter` option in `RunOptions` — callers can pass a predicate to skip
  tasks without removing them from the graph (skipped tasks are reported as
  SKIP in the insight output).
- `lintOnly` mode: when `performance.lintOnlyForNonCritical` is enabled and no
  changed file touches a critical route, execution is restricted to lint-named
  tasks and a notice is written to stderr.
- pnpm workspace detection now also recognises `pnpm-workspace.yaml` (not just
  `pnpm-lock.yaml`), fixing PM detection in freshly cloned or CI monorepos.

### Fixed

- Commander.js crash on startup ("cannot add command 'trace' as already have
  command 'trace'") — `trace analyze` is now registered as a proper subcommand
  of the `trace` parent command instead of a second top-level command.
- Scheduler bipartite bug: the event-driven scheduler previously created false
  dependencies between tasks at consecutive DAG levels. It now walks real
  `getDependencies()` edges instead of a level-boundary approximation, restoring
  true parallelism.
- `exactOptionalPropertyTypes` violation in `context.ts` — optional git
  `baseRef` is now spread conditionally instead of being passed directly.
- Biome `useLiteralKeys` vs TypeScript `noPropertyAccessFromIndexSignature`
  conflict resolved by disabling `useLiteralKeys` in biome.json; index-
  signature types continue to use bracket notation as the compiler requires.
- Integration test timeout on WSL/Windows — unit test timeout raised to 15 s.

## [0.4.0] - 2026-05-04

### Added

- Git-diff affected packages now narrow content hashing: changed workspace
  packages are passed as `packageScopes` from context into `RunOptions` and
  `hashTaskInputs`, so unchanged packages can cache-hit without re-reading all
  matched inputs.

### Changed

- `scheduler.policy` in config enables the event-driven scheduler (`useScheduler`
  in run options) without requiring a CLI flag.

## [0.3.0] - 2026-05-04

### Added

- Git-diff affected packages now narrow content hashing: changed workspace
  packages are passed as `packageScopes` from context into `RunOptions` and
  `hashTaskInputs`, so unchanged packages can cache-hit without re-reading all
  matched inputs.

### Changed

- `scheduler.policy` in config enables the event-driven scheduler (`useScheduler`
  in run options) without requiring a CLI flag.

## [0.2.0] - 2026-05-03

### Added
- `PackageGraph` workspace discovery and auto-generated tasks (`core/graph`).
- Git-diff pre-filter and parallel input hashing for the cache.
- ts-morph semantic diff classifier.
- Opt-in event-driven scheduler (config + CLI flag).
- Expanded Next.js adapter with `apps/*` discovery.
- Config schema sections: `workspace`, `git`, `semanticDiff`, `scheduler`.
- End-to-end integration tests under `src/__tests__/integration/`.

## [0.1.2] - 2026-04-27

### Fixed
- Command parsing now preserves quoted arguments (`node -e "console.log('x')"`
  no longer crashes). Internally switched from `String.prototype.split(" ")`
  to [`string-argv`](https://www.npmjs.com/package/string-argv).
- `insight` now shows run history for tasks executed in `strict` mode and for
  tasks declared without `inputs`. The runner records `lastRun` and
  `lastDurationMs` for every successful run, hash or no hash.

### Added
- `--concurrency <n>` flag on `build`, `dev`, and `run`. Limits the number
  of tasks executing in parallel within a single DAG level.
  Defaults to `Math.max(1, os.cpus().length - 1)`.
- GitHub Actions CI matrix (`ubuntu` × `windows` × `macos` × Node `20` / `22`)
  running typecheck, tests, and build on every push and pull request.
- Issue templates, pull-request template, security policy, and this changelog.

### Removed
- Six unused `registerXxxCommand` exports (one per CLI command file). The
  lazy-loading `src/cli/index.ts` registers commands inline; the legacy
  exports have not been imported since 0.1.0.

## [0.1.1] - 2026-04-20

### Fixed
- Package now installs cleanly; `npm install antiscaler` no longer fails with
  "cannot read properties of null (reading 'matches')".
- `npx antiscaler init` scaffolds `import { defineConfig } from "antiscaler"`
  (the previous template imported from the misspelled `"antiscale"`).
- `npx antiscaler build` and other CLI commands resolve the library at
  runtime — fixed by splitting the library entry (`dist/index.js`) from the
  CLI binary entry (`dist/cli.js`) in the package's `exports` map.

### Changed
- `package.json` now declares `engines.node: ">=20"`, a proper `exports` map,
  and dual `tsup` build entries (library + CLI).

## [0.1.0] - 2026-04-15

### Added
- Initial public release.
- `defineConfig` helper and Zod-validated config schema (`antiscale.config.ts`,
  `.js`, or `.mjs`).
- Task DAG with cycle detection (`core/graph`), level-based parallel execution.
- Content-based caching: SHA-256 hashes of input globs; unchanged inputs
  produce a cache hit and skip execution.
- CLI commands: `build`, `dev`, `run <task>`, `init`, `insight`, `env`, `check`.
- Auto-detection for package manager (npm / yarn / pnpm), runtime (Node /
  Bun / Deno), and framework (Next.js / Vite / generic).
- Lazy command registration so `antiscaler --help` stays under 100 ms.

[Unreleased]: https://github.com/saintparish4/antiscaler/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/saintparish4/antiscaler/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/saintparish4/antiscaler/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/saintparish4/antiscaler/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/saintparish4/antiscaler/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/saintparish4/antiscaler/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/saintparish4/antiscaler/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/saintparish4/antiscaler/releases/tag/v0.1.0
