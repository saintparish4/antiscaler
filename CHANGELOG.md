# Changelog

All notable changes to antiscaler are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-09

First stable release. The public API surface — everything exported from
`src/index.ts` (`defineConfig` and the config types) — is now covered by a
semver stability guarantee: no breaking changes in minor or patch releases.

### Added

- **API stability declaration** — all public exports carry `@public` JSDoc
  tags; the `import`/`./tracer` entry points are the supported surface.

### Security

- **Remote cache hardening** — entries fetched from a remote backend are now
  shape-validated before use; a malformed or corrupt entry is treated as a
  cache miss instead of throwing and failing the run.
- **HTTP cache adapter** caps response bodies to guard against a hostile or
  buggy endpoint exhausting memory.
- **`git diff` invocation** now passes a `--` path terminator so a crafted
  base ref can never be interpreted as a git option (argument-injection
  hardening).

### Changed

- Documentation now steers users away from committing remote-cache secrets to
  `antiscale.config.ts`, recommending environment variables / the AWS
  credential chain instead.

## [0.9.3] - 2026-06-09

### Security

- **Glob input hardening** — `hashTaskInputs` now rejects absolute patterns and
  any pattern containing a `..` segment, so task `inputs` cannot be used to read
  files outside the project root.

## [0.9.2] - 2026-06-08

### Added

- **Documentation** (`docs/`): complete documentation suite for new users.
  - `docs/getting-started.md` — single-repo setup from scratch to first cache hit
  - `docs/monorepo.md` — pnpm workspace setup, `--affected`, cascade scoping
  - `docs/nextjs.md` — tracer plugin setup, lint-only fast path walkthrough
  - `docs/vite.md` — Vite plugin setup
  - `docs/pr-commands.md` — `pr check`, `pr replay`, `pr report`, and GitHub Actions integration
  - `docs/remote-cache.md` — HTTP and S3 backend setup, TTL eviction, cost modeling
  - `docs/config-reference.md` — every config key with type, default, and example
  - `docs/troubleshooting.md` — top 10 problems and fixes
- **README rewrite** — concise feature table, install + minimal config as copy-paste quick start, links to all guides.
- **JSDoc** on all public exports in `src/index.ts`.

## [0.9.1] - 2026-06-08

### Added

- **`antiscaler doctor`** — health-check command that validates Node version, locates and Zod-validates the config file, reports cache directory size with a warning threshold (500 MB), and checks for required trace sessions when `performance.criticalPaths` is configured.
- **Interactive `init`** — `antiscaler init` now detects your package manager, framework, and existing `package.json` scripts, then walks through task configuration interactively (TTY). Falls back to a minimal non-interactive config in CI / piped contexts.
- **Progress output** — running tasks now print a live progress line so long builds don't appear frozen.
- **`--dry-run` flag** — pass `--dry-run` to any execution command (`build`, `run`, `dev`) to print what would run without executing anything.

## [0.9.0] - 2026-06-08

### Added

- **Remote cache** (`cache.remote`): cache hits now survive across machines
  (CI ↔ local, CI run A ↔ CI run B). Configure a backend in `antiscale.config.ts`:
  - `type: "http"` — generic presigned-URL backend; works with S3, GCS, R2, or
    any server that accepts `GET`/`PUT`/`HEAD` on `{baseUrl}/{hash}`. Supports
    custom request headers (e.g. `Authorization`) and a configurable timeout.
  - `type: "s3"` — native AWS S3 backend (lazy-imports `@aws-sdk/client-s3`
    on first use, so the dep is only required when this backend is active).
    Supports custom endpoint for R2/MinIO/localstack, explicit credentials, and
    a configurable key prefix.
- **Remote-hit tracking**: `TaskRunResult` gains `remoteHit?: boolean`. The
  `antiscaler insight` table now shows a footer line:
  `Remote cache hits: N  Estimated time saved: Xms`.
- **Cost modeling** (`cache.costPerMissMs`): configuration hook for annotating
  the expected cost of a cache miss; surfaced in the insight summary.
- **TTL eviction** (`cache.ttlDays`): local cache entries older than the
  specified number of days are evicted at the start of every run.

## [0.8.0] - 2026-06-07

### Added

- **Workspace cascade** (`computeAffectedPackages`): when package A changes, any
  package that declares A as a workspace dependency (directly or transitively) is
  automatically included in the affected set. The `packageScopes` hash filter now
  covers the full cascade, so dependents are hashed against their own files rather
  than against an empty scope.
- **`antiscaler build --affected`**: runs only the tasks belonging to packages in
  the cascade-expanded affected set. Non-affected tasks are recorded as `SKIP` in
  the insight table. Composable with the existing `lintOnly` filter.
- Integration test: two-commit git fixture validates that changing `packages/utils`
  cascades to `web` and `api` while `docs` (no utils dependency) is skipped.

## [0.7.0] - 2026-06-04

### Added

- `antiscaler pr check` — runs a three-dot git diff against a base branch,
  classifies every changed `.ts`/`.tsx` file via the AST semantic differ, and
  reports a per-file table plus a rollup verdict: `safe to skip build`,
  `build recommended`, or `build required`.
- `antiscaler pr replay` — loads the last recorded trace session and intersects
  its module list with the PR-changed files to report which routes and packages
  are touched by this PR.
- `antiscaler pr report` — combines `pr check` and `pr replay` into a single
  structured JSON output. Pass `--markdown` for a GitHub-comment-ready summary
  and `--output <file>` to write to disk instead of stdout.
- GitHub Actions workflow (`.github/workflows/pr-report.yml`) that runs
  `antiscaler pr report --markdown` on every pull request and posts or updates
  a sticky comment with the report.
- All three PR commands accept `--base <ref>` (default: `main`) and `pr replay`
  / `pr report` also accept `--session <id>` (default: last recorded session).

## [0.5.1] - 2026-05-21

### Fixed

- README updated to reflect current 0.5.x feature set and CLI reference.

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

[Unreleased]: https://github.com/saintparish4/antiscaler/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/saintparish4/antiscaler/compare/v0.9.3...v1.0.0
[0.9.3]: https://github.com/saintparish4/antiscaler/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/saintparish4/antiscaler/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/saintparish4/antiscaler/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/saintparish4/antiscaler/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/saintparish4/antiscaler/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/saintparish4/antiscaler/compare/v0.5.1...v0.7.0
[0.5.1]: https://github.com/saintparish4/antiscaler/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/saintparish4/antiscaler/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/saintparish4/antiscaler/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/saintparish4/antiscaler/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/saintparish4/antiscaler/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/saintparish4/antiscaler/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/saintparish4/antiscaler/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/saintparish4/antiscaler/releases/tag/v0.1.0
