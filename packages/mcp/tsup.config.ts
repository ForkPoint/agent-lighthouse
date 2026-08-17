import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts',
  },
  format: ['cjs', 'esm'],
  banner: ({ entry }) => {
    if (entry === 'server') {
      return { js: '#!/usr/bin/env node' };
    }
    return {};
  },
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
