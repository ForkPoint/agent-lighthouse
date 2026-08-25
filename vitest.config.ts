import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts'],
    // The live-site verification suite holds worker slots for minutes while it
    // fetches real sites. On a two-core CI runner that starves the mock-only
    // suites, and orchestrator/corpus tests that finish in under a second
    // locally were timing out at the 5s default.
    testTimeout: 30_000,
    alias: {
      '@forkpoint/agent-lighthouse-core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@forkpoint/agent-lighthouse-report': resolve(__dirname, 'packages/report/src/index.ts'),
      '@forkpoint/agent-lighthouse-mcp': resolve(__dirname, 'packages/mcp/src/index.ts'),
    },
  },
});
