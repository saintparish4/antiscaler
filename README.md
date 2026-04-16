# Antiscale

Adaptive dev orchestration CLI that understands your project, builds a task
dependency graph, and executes only what's necessary using content-based
caching and runtime detection. Instead of locking you into one stack, Antiscale
sits on top of whatever you already use and optimizes your dev loop.

## Features

- **Auto-detection** — Detects your package manager (npm / yarn / pnpm),
  runtime (Node / Bun / Deno), and framework (Next.js / Vite / generic).
- **Task DAG** — Declare `dependsOn` between tasks; Antiscale resolves the
  dependency graph and runs each level in parallel.
- **Content hashing** — SHA-256 hashes of input globs; unchanged inputs
  produce a cache hit and skip execution entirely.
- **Insight command** — See per-task timings, cache hit rates, and historical
  run data at a glance.
- **Works anywhere** — No monorepo tooling required. Drop a config file into
  any repo and go.

## Quick Start

```bash
# Install
npm install -D antiscale

# Scaffold a config file
npx antiscale init

# Run your build
npx antiscale build

# Re-run — cached tasks are skipped
npx antiscale build

# See timing and cache stats
npx antiscale insight
```

## Configuration

Create `antiscale.config.ts` in your project root (or `.js` / `.mjs`):

```typescript
import { defineConfig } from "antiscale";

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

| Field              | Type                        | Default               | Description                          |
| ------------------ | --------------------------- | --------------------- | ------------------------------------ |
| `strategy`         | `"adaptive" \| "strict"`    | `"adaptive"`          | Cache behavior                       |
| `cache.mode`       | `"content"`                 | `"content"`           | Hashing mode (content-based)         |
| `cache.directory`  | `string`                    | `".antiscale/cache"`  | Where cache files are stored         |
| `tasks`            | `Record<string, TaskConfig>`| `{}`                  | Named tasks                          |
| `tasks.*.command`  | `string`                    | `<pm> run <taskName>` | Shell command to execute             |
| `tasks.*.inputs`   | `string[]`                  | `[]`                  | Glob patterns for cache hashing      |
| `tasks.*.dependsOn`| `string[]`                  | `[]`                  | Tasks that must run first            |

## CLI Reference

```
antiscale <command> [options]

Commands:
  build          Run the build task through the DAG
  dev            Start the dev server (framework-aware)
  run <task>     Run any named task
  init           Scaffold antiscale.config.ts
  insight        Show timing and cache hit stats
  env            Show detected runtime, PM, and framework
  check          Validate config and DAG (no execution)

Options:
  -V, --version  Show version
  -h, --help     Show help
```

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

## License

MIT — see [LICENSE](./LICENSE).
