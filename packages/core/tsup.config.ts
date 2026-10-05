import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  // TypeScript 7 emits declarations after the JavaScript bundle.
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
});
