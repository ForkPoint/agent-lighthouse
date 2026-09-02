import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.{test,spec}.ts"],
    // The live-site verification suite holds worker slots for minutes while it
    // fetches real sites. On a two-core CI runner that starves the mock-only
    // suites, and orchestrator/corpus tests that finish in under a second
    // locally were timing out at the 5s default.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      // Source only. Tests, build output, fixtures and the Astro pages (which
      // vitest never renders) would otherwise dilute the figure.
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/__tests__/**",
        "**/__fixtures__/**",
        "**/test-utils.ts",
        "**/_test-utils.ts",
        "packages/core/src/tests/**",
        "packages/core/src/audits/proposed/**",
        "packages/website/src/pages/**",
        // Entry points: each connects a transport or reads process.argv at
        // module scope and runs on import, so a test can never reach one.
        // Their logic lives in options.ts and tool.ts, which are covered; what
        // is left is console printing and process.exit.
        "packages/cli/src/main.ts",
        "packages/mcp/src/server.ts",
        // Astro build-time config, never evaluated by vitest.
        "packages/website/src/content.config.ts",
      ],
    },
    alias: {
      "@forkpoint/agent-lighthouse-core": resolve(
        __dirname,
        "packages/core/src/index.ts",
      ),
      "@forkpoint/agent-lighthouse-report": resolve(
        __dirname,
        "packages/report/src/index.ts",
      ),
      "@forkpoint/agent-lighthouse-mcp": resolve(
        __dirname,
        "packages/mcp/src/index.ts",
      ),
    },
  },
});
