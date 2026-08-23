// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://forkpoint.github.io',
  base: '/agent-lighthouse',
  trailingSlash: 'always',
  vite: { plugins: [tailwind()] },
});
