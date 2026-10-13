import { defineConfig } from "tsup";

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
});
