import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts", "src/bin.ts"],
  // bin.ts loads main.js at run time, after it turns source maps on; bundling
  // main into it would load everything before that line runs.
  external: [/\/main\.js$/],
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
