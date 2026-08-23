// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://forkpoint.github.io',
  base: '/agent-lighthouse',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwind()],
    // Core is a linked workspace package, so Vite inlines it into the prerender
    // bundle together with its whole runtime (jsdom, cheerio, undici) — and
    // jsdom loads its default stylesheet through `__dirname`, which does not
    // exist in the ESM bundle Vite emits. The site only reads the audit
    // registry, so let Node import the built package at prerender time instead.
    resolve: { external: ['@forkpoint/agent-lighthouse-core'] },
  },
});
