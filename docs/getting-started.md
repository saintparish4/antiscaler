# Getting started

This guide takes you from zero to a working linkctl setup with a cache hit on the second run.

## Prerequisites

- Node.js ≥ 20
- An existing project with at least one script in `package.json` (e.g. `build`, `test`, `lint`)

## 1. Install

```bash
npm install -D linkctl
```

## 2. Create a config

Run `init` to scaffold `linkctl.config.ts` interactively:

```bash
npx linkctl init
```

linkctl detects your package manager, framework, and existing `package.json` scripts and suggests sensible defaults. Accept the prompts or type your own values.

The result is a file like this:

```typescript
// linkctl.config.ts
import { defineConfig } from "linkctl";

export default defineConfig({
  strategy: "adaptive",
  tasks: {
    build: {
      command: "npm run build",
      inputs: ["src/**/*", "package.json"],
    },
    test: {
      command: "npm test",
      inputs: ["src/**/*", "tests/**/*"],
      dependsOn: ["build"],
    },
  },
});
```

## 3. Verify the setup

```bash
npx linkctl doctor
```

Doctor checks Node version, validates your config against the schema, and warns if the cache is large or a required trace session is missing.

Example output:

```
[✓] Node v22.4.0 meets requirement ≥20
[✓] Config found: linkctl.config.ts
[✓] Config is valid
[✓] Cache directory is 0 MB
```

## 4. First run

```bash
npx linkctl build
```

linkctl builds the task graph (`test` depends on `build`), hashes the inputs for each task, finds no cached hashes, and runs both tasks. You should see output like:

```
TASK    DURATION   STATUS
-------------------------------
build   4200ms     MISS
test    12100ms    MISS
```

## 5. Second run — cache hit

Run the same command again without changing any source files:

```bash
npx linkctl build
```

Both tasks hit the cache and are skipped:

```
TASK    DURATION   STATUS
-------------------------------
build   -          HIT
test    -          HIT
```

## 6. Inspect history

```bash
npx linkctl insight
```

Shows each task's last run timestamp and duration from the local cache history. If the previous run included a remote cache, also prints the remote hit count and estimated time saved.

## Next steps

- **Add `dependsOn`** between tasks to express ordering — e.g. `test: { dependsOn: ["build"] }`.
- **Tune `inputs`** to be as narrow as possible. The narrower the glob, the fewer cache invalidations.
- **Add tasks for lint and typecheck** and run them in parallel with `build` by not declaring `dependsOn`.
- **Set up a remote cache** so CI and local dev share hits — see [remote-cache.md](./remote-cache.md).
- **Monorepo?** See [monorepo.md](./monorepo.md).
