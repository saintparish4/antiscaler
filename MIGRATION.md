# Migration Notes

- Split the quality gate into Formatting → Linting → Typechecking: `pnpm format:check`, `pnpm lint` (`biome check .`), and `pnpm typecheck` (`tsc --noEmit`). Removed `lint:typecheck`.
