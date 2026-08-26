# Vite setup

Link provides a Vite plugin that records which modules and routes are loaded during builds and dev runs — the same trace data used by `link trace analyze` and the lint-only fast path.

## 1. Install

```bash
npm install -D link
```

## 2. Add the Vite plugin

```javascript
// vite.config.js (or vite.config.ts)
import { defineConfig } from "vite";
import { linkVitePlugin } from "link/tracer";

export default defineConfig({
  plugins: [
    linkVitePlugin(),
  ],
});
```

The plugin hooks into `generateBundle` to record entry chunks and their associated routes, writing sessions to `.link/traces/<sessionId>.json`.

## 3. Record a trace session

```bash
npx link trace
```

Starts your Vite dev server with tracing active. Navigate through the routes you want to mark as critical, then stop the server.

```bash
# Inspect the most recent session
npx link trace analyze
```

## 4. Minimal config

```typescript
// link.config.ts
import { defineConfig } from "link";

export default defineConfig({
  tasks: {
    build: {
      command: "vite build",
      inputs: ["src/**/*", "index.html", "package.json"],
    },
    lint: {
      command: "eslint src",
      inputs: ["src/**/*"],
    },
    test: {
      command: "vitest run",
      inputs: ["src/**/*"],
    },
  },
});
```

## 5. Lint-only fast path

Same as Next.js — declare critical paths and enable `lintOnlyForNonCritical`:

```typescript
performance: {
  lintOnlyForNonCritical: true,
  criticalPaths: ["/checkout", "/login"],
},
```

See [nextjs.md](./nextjs.md) for a detailed walkthrough of this feature; the behavior is identical for Vite.

## Notes

- Vite route detection maps entry file paths to URLs using a `pages/`, `routes/`, or `views/` directory convention (with an optional `src/` prefix). Entry files outside these directories are recorded in the module list but are not assigned a route.
- Add `.link/` to `.gitignore` to avoid committing trace sessions.
