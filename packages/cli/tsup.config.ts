import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  // TypeScript 7 emits declarations after the JavaScript bundle.
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
});
