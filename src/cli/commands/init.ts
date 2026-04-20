import path from "path";
import { existsSync, writeFileSync } from "fs";

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
  const dest = path.join(process.cwd(), "antiscale.config.ts");
  if (existsSync(dest)) {
    console.log("antiscale.config.ts already exists — nothing written.");
    return;
  }
  writeFileSync(dest, TEMPLATE);
  console.log("Created antiscale.config.ts");
}
