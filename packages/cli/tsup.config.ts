import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
