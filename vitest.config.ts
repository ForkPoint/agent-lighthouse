import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // scripts/ is included so the website generator is gated like any other
    // code — it reads the live registry and its output ships to users.
    include: ['packages/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'],
    alias: {
      '@forkpoint/agent-lighthouse-core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@forkpoint/agent-lighthouse-report': resolve(__dirname, 'packages/report/src/index.ts'),
      '@forkpoint/agent-lighthouse-mcp': resolve(__dirname, 'packages/mcp/src/index.ts'),
    },
  },
});
