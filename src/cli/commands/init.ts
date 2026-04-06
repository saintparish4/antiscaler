import type { Command } from "commander";
import path from "path";
import { existsSync, writeFileSync } from "fs";

const TEMPLATE = `import { defineConfig } from "antiscale";

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

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold antiscale.config.ts in the current directory")
    .action(() => {
      const dest = path.join(process.cwd(), "antiscale.config.ts");
      if (existsSync(dest)) {
        console.log("antiscale.config.ts already exists — nothing written.");
        return;
      }
      writeFileSync(dest, TEMPLATE);
      console.log("Created antiscale.config.ts");
    });
}
