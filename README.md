# Antiscaler

[![npm version](https://img.shields.io/npm/v/antiscaler.svg)](https://www.npmjs.com/package/antiscaler)
[![CI](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml/badge.svg)](https://github.com/saintparish4/antiscaler/actions/workflows/ci.yml)

A build orchestrator that skips work you haven't changed — a task DAG, content-based caching, and workspace scoping, driven by `antiscale.config.ts`.

This README is for working **on** Antiscaler. Using it in your own project is documented in [docs/](./docs/getting-started.md).

---

## Requirements

| | Version | Notes |
|---|---|---|
| Node | ≥ 20 | Enforced via `engines`; CI tests 20, 22, and 24 |
| pnpm | ≥ 10 | Pinned by `packageManager` |
| git | any recent | Needed to exercise `--affected`, `diff`, `impact`, and `pr *` — they no-op without a repo |

Optional, only if you touch the matching area:

- **`@aws-sdk/client-s3`** — dynamically imported by the S3 remote-cache backend (`s3-adapter.ts:49`) and deliberately not a declared dependency. Install it locally to exercise that path.
- **[hyperfine](https://github.com/sharkdp/hyperfine)** — required by `pnpm bench`.

---

## Installation

```bash
git clone https://github.com/saintparish4/antiscaler.git
cd antiscaler
pnpm install
pnpm build               # required before the CLI or E2E tests can run
node dist/cli.js --help  # smoke test
```

---

## Development

```bash
pnpm build             # compile all three entry points to dist/ via tsup
pnpm clean             # delete dist/
pnpm format            # biome format --write .
pnpm format:check      # biome format (read-only)
pnpm lint              # biome check . (static analysis, read-only)
pnpm typecheck         # tsc --noEmit
pnpm check             # biome check --write — local autofix (format + lint + organize imports)
pnpm bench             # benchmark harness (pnpm bench:quick for a fast pass)
```

The default branch is `alpha`, and it is expected to be lint-clean — if `pnpm format:check`, `pnpm lint`, or `pnpm typecheck` is red, your change caused it.

There is no watch build. The loop is `pnpm build && node dist/cli.js <command>`, run against a scratch project or one of the fixture workspaces in `src/__tests__/fixtures/`.

`src/cli/index.ts` registers every command with a dynamic `import()` inside its `action()` callback, deferring execa, jiti, and fast-glob until a command actually runs. That is what keeps `antiscaler --help` fast, and it is the one sanctioned exception to the project's prefer-top-level-imports rule — the benchmark job fails if startup regresses past 200 ms.

Benchmark methodology and how to reproduce the published numbers: [benchmarks/README.md](./benchmarks/README.md).

---

## Testing

Three tiers, each answering a different question. Write a test at the cheapest tier that can answer yours.

| Tier | Tests | Lives in | Runs against |
|------|-------|----------|--------------|
| Unit | Isolated behavior — one module, collaborators substituted | `src/**/__tests__/*.test.ts` | Source |
| Integration | Boundaries — real modules meeting, or a real edge (filesystem, git, config) | `src/__tests__/integration/` | Source |
| E2E | User workflows through the shipped binary | `src/__tests__/e2e/` | Built `dist/` |

```bash
pnpm test              # watch mode
pnpm test:run          # every tier, once
pnpm test:integration  # boundaries only
pnpm test:e2e          # workflows only — run pnpm build first
pnpm test:all          # everything + coverage
pnpm vitest run src/core/graph/__tests__/dag.test.ts   # a single file
```

Unit tests never shell out — `runTasksWithDeps` takes a `TaskExecutor`, so tests inject a mock. Fixture workspaces are shared across tiers at `src/__tests__/fixtures/`. Coverage gates in CI: 70% lines/statements/functions, 60% branches.

---

## Environment Variables

Antiscaler takes no configuration from the environment — that lives in `antiscale.config.ts`. What it reads are standard terminal and CI signals:

| Variable | Read by | Effect |
|---|---|---|
| `NO_COLOR` | `visuals/color.ts`, `progress/reporter.ts`, `doctor.ts` | Disables color everywhere. Highest-priority env signal. |
| `FORCE_COLOR` | `visuals/color.ts` | Forces color on when output is not a TTY. |
| `CLICOLOR_FORCE` | `visuals/color.ts` | Same as `FORCE_COLOR`. |
| `CI` | `progress/reporter.ts`, `doctor.ts` | Suppresses color and animated progress. |
| `JPY_SESSION_NAME` | `visuals/progress.ts` | Detects a Jupyter session and falls back to line-based output. |
| `ANTISCALE_TEST_NO_CLI_PROGRESS` | `visuals/printer.ts`, `visuals/progress.ts` | Test-only. Suppresses progress bars so concurrent output stays assertable. |
| `ANTISCALER_TRACE` | Set by `antiscaler trace` | Exported to the spawned dev process. Nothing in Antiscaler reads it back — the tracer plugins are unconditional once installed. |

Color precedence: `--color <when>` → `--no-color` → `NO_COLOR` → `FORCE_COLOR`/`CLICOLOR_FORCE` → TTY detection.

To exercise the S3 remote-cache backend locally, note that the config schema has no credential fields — `cli/context.ts` passes only `bucket`, `prefix`, `region`, and `endpoint`, so authentication comes entirely from the AWS SDK default chain (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE`, `AWS_REGION`) or an instance/OIDC role. Keep credentials out of config files; they are committed.

---

## Architecture

Layered, dependencies pointing one way: `cli → core → adapters`. Ports are owned by `core`; adapters implement them and import nothing from `core` except types.

| Directory | Role |
|---|---|
| `src/cli/` | Commander wiring, option parsing, terminal rendering |
| `src/core/` | Orchestration logic, grouped by capability — `cache`, `graph`, `execution`, `semantic`, `scope`, `detection`, `plugins` |
| `src/adapters/` | The outside world — package managers, runtimes, frameworks |
| `src/tracer/` | Webpack and Vite plugins that record module resolution |
| `src/types/` | Contracts shared across layers |

`tsup` builds three entry points: `dist/index.js` (library API), `dist/cli.js` (the `antiscaler` binary), and `dist/tracer.js` (framework plugins).

The request path for most commands: `cli/context.ts:createContext()` loads config, detects PM/runtime/framework, builds the task DAG, and computes git-diff scoping — then `core/execution:runTasksWithDeps()` walks DAG levels while `core/cache` hashes inputs against `.antiscale/cache/cache.json`.

Two rules to know before your first PR: business logic does not live in command handlers, and `core` never prints or exits — it throws `AntiscaleError` subclasses and lets the CLI top level map them to exit codes (`AntiscaleError` → 1, unexpected → 2). Full detail in [CLAUDE.md](./CLAUDE.md).

---

## Deployment

Antiscaler ships as an npm package; there is no server to deploy.

```bash
pnpm publish            # prepublishOnly runs `pnpm test:all && pnpm build`
```

Only `dist/` is published (`files: ["dist"]`). The package exposes `.` and `./tracer` through the `exports` map, both ESM-only (`"type": "module"`).

Releases are currently **manual** — `.github/workflows/release.yml` has been removed, and `deploy.yml` and `security.yml` are empty placeholders. Before publishing: bump the version, update [CHANGELOG.md](./CHANGELOG.md), and confirm CI is green on `alpha`.

Everything exported from `antiscaler` and `antiscaler/tracer` follows [semantic versioning](https://semver.org), so a breaking change to either surface cannot ship in a minor or patch release.

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow and [CLAUDE.md](./CLAUDE.md) for architecture and code-style rules. The short version:

- All PRs must pass `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Changed behavior needs a test; a bug fix needs a test that fails before it.
- Behavior changes that users can observe need a `docs/` update in the same PR.
- Conventional commits: `<type>: <subject>`, imperative mood, ≤ 72 chars, no trailing period.
- Bump one dependency at a time — never a blanket `pnpm update` — so lockfile diffs stay reviewable.

---

## License

MIT — see [LICENSE](./LICENSE).
