import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  // tsup injects baseUrl; retain its TS6 API until its declaration bundler migrates.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  sourcemap: true,
  splitting: false,
});
