import { defineConfig } from "tsup";

const packageVersion = process.env.npm_package_version ?? "unknown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageVersion),
  },
  // TypeScript 7 emits declarations after the JavaScript bundle.
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
});
