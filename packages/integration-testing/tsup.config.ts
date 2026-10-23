import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  banner: { js: "#!/usr/bin/env node" },
  dts: false,
  clean: true,
  sourcemap: true,
});
