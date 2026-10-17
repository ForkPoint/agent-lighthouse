import { defineConfig } from "tsup";

const packageVersion = process.env.npm_package_version ?? "unknown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
    // The command. Its own first line is the shebang, which esbuild keeps.
    bin: "src/bin.ts",
  },
  // bin.ts loads server.js at run time, after it turns source maps on;
  // bundling the server into it would load everything before that line runs.
  external: [/\/server\.js$/],
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
