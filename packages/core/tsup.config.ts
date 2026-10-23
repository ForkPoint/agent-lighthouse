import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

export default defineConfig({
  // `contracts` is the dependency-free entry for browser code. Splitting puts
  // its definitions in one chunk that `index` imports too, so both entries
  // export the same objects instead of two copies.
  entry: ["src/index.ts", "src/contracts.ts", "src/schemas.ts"],
  format: ["cjs", "esm"],
  // TypeScript 7 emits declarations after the JavaScript bundle.
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: true,
  // `CORE_VERSION` in registry-summary.ts reads this.
  define: { __AGENT_LIGHTHOUSE_CORE_VERSION__: JSON.stringify(version) },
});
