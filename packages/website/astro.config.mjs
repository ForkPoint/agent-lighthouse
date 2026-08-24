// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { dossierLinksPlugin } from './src/lib/dossier-links.ts';

// The dossiers this site publishes, read from disk rather than from the content
// collection: the plugin is built here, before Astro has a collection to
// ask. Ids match the collection's — `<category>/<slug>`.
const dossierDir = new URL('../../docs/evidence/audits/', import.meta.url);
const published = new Set(
  readdirSync(dossierDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(new URL(`${entry.name}/`, dossierDir))
        .filter((file) => file.endsWith('.md'))
        .map((file) => `${entry.name}/${file.replace(/\.md$/, '')}`),
    ),
);

export default defineConfig({
  site: 'https://forkpoint.github.io',
  base: '/agent-lighthouse',
  trailingSlash: 'always',
  markdown: {
    // Sätteri is Astro 7's default Markdown processor and is named here only to
    // hang a plugin off it: dossier links are written for GitHub, and the plugin
    // rewrites them for the site. `markdown.remarkPlugins` would instead swap the
    // whole site onto the deprecated unified processor.
    processor: satteri({ mdastPlugins: [dossierLinksPlugin(published)] }),
  },
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
