import { defineConfig } from "tsup";

const packageVersion = process.env.npm_package_version ?? "unknown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
  },
  format: ["cjs", "esm"],
  banner: ({ entry }) => {
    if (entry === "server") {
      return { js: "#!/usr/bin/env node" };
    }
    return {};
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageVersion),
  },
  // tsup injects baseUrl; retain its TS6 API until its declaration bundler migrates.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  sourcemap: true,
  splitting: false,
});
