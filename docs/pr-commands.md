# PR commands

Link's `pr` subcommands help you understand what a pull request actually changes — both at the TypeScript AST level and in terms of which routes and packages your running app loads.

## Commands

### `pr check`

Classifies every changed `.ts` / `.tsx` file by comparing its exported symbols before and after:

```bash
npx link pr check
npx link pr check --base origin/main
```

Output:

```
Base ref: main
Changed .ts files: 4

File classifications:
  non-impacting  src/utils/format.ts
  internal       src/hooks/useCart.ts  (~2 changed)
  breaking       src/api/checkout.ts   (-1 removed, ~1 changed)

Verdict: build required
```

**Classifications:**

| Label | Meaning |
|-------|---------|
| `non-impacting` | No exported symbols changed (comments, whitespace, private code) |
| `internal` | Exported symbols changed in a backwards-compatible way |
| `breaking` | Exported symbols removed or their signatures changed |

**Verdicts:**

| Verdict | Triggered when |
|---------|---------------|
| `safe to skip build` | All files are `non-impacting` |
| `build recommended` | At least one file is `internal` |
| `build required` | At least one file is `breaking` |

### `pr replay`

Loads the last recorded trace session and intersects the list of changed files with the modules recorded during that session:

```bash
npx link pr replay
npx link pr replay --base origin/main --session <sessionId>
```

Output:

```
Base ref:        main
Trace session:   abc123
Framework:       next
Changed files:   6
Touched modules: 2

Touched routes:
  /checkout  (44 modules)
  /cart      (31 modules)

Touched packages:
  @myapp/ui
  @myapp/checkout
```

This tells you which user-facing routes are affected by the PR — useful for deciding what to manually test.

### `pr report`

Runs both `pr check` and `pr replay` and produces a combined report:

```bash
# JSON to stdout
npx link pr report

# Markdown suitable for a GitHub comment
npx link pr report --markdown

# Write to a file
npx link pr report --markdown --output pr-report.md
```

JSON output shape:

```json
{
  "generatedAt": "2026-06-08T12:00:00.000Z",
  "check": {
    "baseRef": "main",
    "tsFilesChanged": 4,
    "files": [...],
    "verdict": "build-required"
  },
  "replay": {
    "baseRef": "main",
    "sessionId": "abc123",
    "framework": "next",
    "changedFiles": [...],
    "touchedModules": [...],
    "touchedRoutes": [...],
    "touchedPackages": [...]
  }
}
```

## GitHub Actions integration

The workflow at `.github/workflows/pr-report.yml` runs `pr report --markdown` on every pull request and posts (or updates) a sticky comment with the report.

The workflow is already committed to the repository at `.github/workflows/pr-report.yml`. It uses `actions/github-script` to post or update a sticky comment with `## Link PR Report` as the marker. No additional secrets are required — the default `GITHUB_TOKEN` is sufficient.

The workflow triggers on `pull_request` (opened, synchronize, reopened), installs dependencies with pnpm, runs `link pr report --base ${{ github.base_ref }} --markdown --output pr-report.md`, then creates or updates the comment.

## Options

All three `pr` commands accept:

| Flag | Default | Description |
|------|---------|-------------|
| `--base <ref>` | `main` | Git ref to diff against |

`pr replay` and `pr report` also accept:

| Flag | Default | Description |
|------|---------|-------------|
| `--session <id>` | last recorded | Trace session to use for replay |

`pr report` also accepts:

| Flag | Default | Description |
|------|---------|-------------|
| `--markdown` | false | Output GitHub-comment-ready Markdown instead of JSON |
| `--output <file>` | stdout | Write output to a file |
