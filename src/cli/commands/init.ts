import { writeFileSync } from "node:fs";
import path from "node:path";
import { findAntiscaleConfigPath } from "../../core/config/loader.js";

const TEMPLATE = `import { defineConfig } from "antiscaler";

export default defineConfig({
  strategy: "adaptive",
  tasks: {
    build: { 
      command: "npm run build",
      inputs: ["src/**/*", "package.json"],
    },
  },
});
`;

export function registerInitAction(): void {
  const cwd = process.cwd();
  const existing = findAntiscaleConfigPath(cwd);
  if (existing) {
    console.log(`${path.basename(existing)} already exists — nothing written.`);
    return;
  }
  const dest = path.join(cwd, "antiscale.config.ts");
  writeFileSync(dest, TEMPLATE);
  console.log("Created antiscale.config.ts");
}
