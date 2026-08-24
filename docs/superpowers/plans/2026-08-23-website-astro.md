# Astro Website Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 478 KB `packages/website/index.html` with an Astro site that publishes all 215 audit dossiers by rendering the markdown already checked into `docs/evidence/audits/`, plus the docs sections rendered from existing markdown.

**Architecture:** `packages/website` becomes an Astro package whose content collections load markdown *in place* from `../../docs/evidence` and `../../..`-relative repo paths — nothing is copied. Registry metadata is imported directly from `@forkpoint/agent-lighthouse-core` as a workspace dependency, so the audit list on the site is the audit list the scanner runs. A build-time cross-check fails the build when the registry and the dossier set disagree. Chrome (header, sidebar, table of contents, prev/next, search dialog) is hand-written; three islands are vanilla TypeScript with no UI framework.

**Tech Stack:** Astro 7, Tailwind CSS 4 via `@tailwindcss/vite`, Pagefind 1.5, TypeScript 5.7, vitest 2 (root config already globs `packages/**/*.test.ts`), pnpm 9 workspace.

**Design spec:** `docs/superpowers/specs/2026-08-23-website-astro-design.md`

## Global Constraints

- Dossier markdown under `docs/evidence/` is **read, never written**. No task copies, moves or rewrites a dossier. Link rewriting happens on rendered output only.
- Site base path is `/agent-lighthouse`; deployed origin is `https://forkpoint.github.io`. Every internal link resolves through `import.meta.env.BASE_URL`.
- `packages/website/package.json` carries `"private": true` so changesets never publishes it.
- Published content scope: audit dossiers, `docs/evidence/POLICY.md`, `docs/evidence/sources.json`. **Not** `merged/`, `sunset/`, `deletions/`, `proposals/` — links into those resolve to GitHub.
- No UI framework. Islands are `.ts` files loaded with `<script>` in an `.astro` component.
- All code comments in English. Lint with `rtk err pnpm lint` (oxlint), never ESLint.
- Every task ends with: `AL_SKIP_NETWORK=1 pnpm test`, `pnpm typecheck`, `rtk err pnpm lint`, and — from Task 1 onward — `pnpm --filter @forkpoint/agent-lighthouse-website build`.
- `node scripts/check-dossiers.mjs` must keep passing; it guards the same files the site now renders.
- Old `index.html` keeps serving until Task 12. Nothing is deleted before its replacement passes tests.

## File Structure

| File | Responsibility |
| :-- | :-- |
| `packages/website/package.json` | Astro package manifest, private, depends on core |
| `packages/website/astro.config.mjs` | site, base, Tailwind vite plugin, remark link resolver |
| `packages/website/tsconfig.json` | extends `astro/tsconfigs/strict` |
| `packages/website/src/content.config.ts` | `audits` and `policy` collections, glob loaders + zod schemas |
| `packages/website/src/lib/registry.ts` | Reads `defaultConfig` from core; exports `auditList()`, `categoryList()` |
| `packages/website/src/lib/cross-check.ts` | Registry ↔ dossier reconciliation, throws on mismatch |
| `packages/website/src/lib/routes.ts` | `auditPath(id)`, `categoryPath(id)`, `docPath(slug)`, `withBase(path)` |
| `packages/website/src/lib/dossier-links.ts` | Rewrites relative markdown links at render time |
| `packages/website/src/lib/markdown-slice.ts` | Extracts a named `##` section out of a repo markdown file |
| `packages/website/src/layouts/Base.astro` | html/head/body shell, theme, header, footer |
| `packages/website/src/layouts/Doc.astro` | sidebar + article + table of contents + prev/next |
| `packages/website/src/components/*.astro` | `SiteHeader`, `SidebarNav`, `TableOfContents`, `PrevNext`, `SearchDialog`, `AuditCard`, `GradeBadge`, `TierBadge` |
| `packages/website/src/islands/*.ts` | `audit-explorer.ts`, `badge-generator.ts`, `report-viewer.ts`, `sources-table.ts` |
| `packages/website/src/pages/**` | Routes listed in the spec |
| `packages/website/src/styles/global.css` | `@import "tailwindcss"` + brand tokens |
| `docs/SCORING.md`, `docs/CLI.md`, `docs/CONFIG.md` | New markdown, extracted from `index.html` in Task 7 |

---

## Task 1: Astro package with the 215 dossier routes

**Files:**
- Create: `packages/website/package.json`, `astro.config.mjs`, `tsconfig.json`, `src/content.config.ts`, `src/lib/routes.ts`, `src/pages/audits/[category]/[slug].astro`, `src/styles/global.css`
- Test: `packages/website/src/content.test.ts`

**Interfaces:**
- Produces: `auditPath(id: string): string`, `categoryPath(category: string): string`, `withBase(path: string): string` from `src/lib/routes.ts`; collections `audits` and `policy`.

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "@forkpoint/agent-lighthouse-website",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "typecheck": "astro check"
  },
  "dependencies": {
    "@forkpoint/agent-lighthouse-core": "workspace:*",
    "astro": "^7.2.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "pagefind": "^1.5.2",
    "tailwindcss": "^4.3.3"
  }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/website/src/content.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditPath } from './lib/routes';

const DOSSIERS = resolve(__dirname, '../../../docs/evidence/audits');

/** Every dossier file on disk, as `<category>/<slug>`. */
function dossierIds(): string[] {
  const out: string[] = [];
  for (const category of readdirSync(DOSSIERS, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const file of readdirSync(resolve(DOSSIERS, category.name))) {
      if (file.endsWith('.md')) out.push(`${category.name}/${file.replace(/\.md$/, '')}`);
    }
  }
  return out.sort();
}

describe('dossier content', () => {
  it('finds one dossier per audit directory entry', () => {
    expect(dossierIds().length).toBeGreaterThan(200);
  });

  it('gives every dossier a route derived from its id', () => {
    expect(auditPath('agentic-commerce/offer-truth-consistency')).toBe(
      '/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
    );
  });

  it('carries the frontmatter fields the collection schema requires', () => {
    for (const id of dossierIds()) {
      const raw = readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(raw);
      expect(front, id).not.toBeNull();
      const block = front![1]!;
      for (const key of ['audit:', 'category:', 'source_file:', 'slug:', 'evidence_grade:', 'tier:']) {
        expect(block.includes(key), `${id} missing ${key}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run packages/website/src/content.test.ts`
Expected: FAIL — `Cannot find module './lib/routes'`.

- [ ] **Step 4: Write the route helpers**

```ts
// packages/website/src/lib/routes.ts

/** The deployed base path. Astro injects it; tests read the same default. */
const BASE = (import.meta.env?.BASE_URL ?? '/agent-lighthouse/').replace(/\/?$/, '/');

/** Prefix a site-absolute path with the base path, exactly once. */
export function withBase(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`;
}

/** Where an audit's dossier is published, derived from its id. */
export function auditPath(id: string): string {
  return withBase(`audits/${id}/`);
}

/** Where a category index is published. */
export function categoryPath(category: string): string {
  return withBase(`categories/${category}/`);
}

/** Where a docs section is published. */
export function docPath(slug: string): string {
  return withBase(`docs/${slug}/`);
}
```

- [ ] **Step 5: Define the collections**

```ts
// packages/website/src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const audits = defineCollection({
  loader: glob({ base: '../../docs/evidence/audits', pattern: '**/*.md' }),
  schema: z.object({
    audit: z.string(),
    category: z.string(),
    source_file: z.string(),
    slug: z.string(),
    evidence_grade: z.enum(['A', 'B', 'C', 'D']),
    tier: z.enum(['scored', 'informative', 'experimental']),
    disposition: z.string(),
    reviewed: z.string(),
    graduated: z.string().optional(),
  }),
});

const policy = defineCollection({
  loader: glob({ base: '../../docs/evidence', pattern: 'POLICY.md' }),
});

export const collections = { audits, policy };
```

- [ ] **Step 6: Write the dossier route**

```astro
---
// packages/website/src/pages/audits/[category]/[slug].astro
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const dossiers = await getCollection('audits');
  return dossiers.map((entry) => {
    const [category, slug] = entry.id.split('/');
    return { params: { category, slug }, props: { entry } };
  });
}

const { entry } = Astro.props;
const { Content, headings } = await render(entry);
---
<html lang="en">
  <head><meta charset="utf-8" /><title>{entry.data.audit}</title></head>
  <body>
    <h1>{entry.data.audit}</h1>
    <Content />
  </body>
</html>
```

Chrome arrives in Task 4; this step proves the pipeline emits 215 pages.

- [ ] **Step 7: Configure Astro**

```js
// packages/website/astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://forkpoint.github.io',
  base: '/agent-lighthouse',
  trailingSlash: 'always',
  vite: { plugins: [tailwind()] },
});
```

- [ ] **Step 8: Build and count the emitted pages**

Run:
```bash
pnpm install
pnpm --filter @forkpoint/agent-lighthouse-core build
pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
find packages/website/dist/audits -name index.html | wc -l
```
Expected: `215`.

- [ ] **Step 9: Run the tests and the gates**

Run: `npx vitest run packages/website/src/content.test.ts && pnpm typecheck && rtk err pnpm lint`
Expected: PASS, 0 errors.

- [ ] **Step 10: Commit**

```bash
git add packages/website pnpm-lock.yaml
git commit -m "feat(website): Astro package rendering every audit dossier in place"
```

---

## Task 2: Registry data and the build-time cross-check

**Files:**
- Create: `packages/website/src/lib/registry.ts`, `packages/website/src/lib/cross-check.ts`, `packages/website/src/pages/audits-data.json.ts`
- Test: `packages/website/src/lib/cross-check.test.ts`

**Interfaces:**
- Consumes: collections from Task 1.
- Produces: `auditList(): AuditRecord[]` and `categoryList(): CategoryRecord[]` from `registry.ts`; `crossCheck(registryIds: string[], dossierIds: string[]): void` from `cross-check.ts`, which throws `Error` naming both differences.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/lib/cross-check.test.ts
import { describe, it, expect } from 'vitest';
import { crossCheck } from './cross-check';
import { auditList, categoryList } from './registry';

describe('crossCheck', () => {
  it('passes when both sides carry the same ids', () => {
    expect(() => crossCheck(['a/b'], ['a/b'])).not.toThrow();
  });

  it('names an audit that has no dossier', () => {
    expect(() => crossCheck(['a/b', 'a/c'], ['a/b'])).toThrow(/a\/c/);
  });

  it('names a dossier that has no audit', () => {
    expect(() => crossCheck(['a/b'], ['a/b', 'a/orphan'])).toThrow(/a\/orphan/);
  });
});

describe('registry', () => {
  it('reads the live registry rather than a snapshot', () => {
    const audits = auditList();
    expect(audits.length).toBeGreaterThan(200);
    const one = audits.find((a) => a.id === 'agentic-commerce/offer-truth-consistency');
    expect(one?.evidenceGrade).toBe('B');
    expect(one?.tier).toBe('scored');
  });

  it('groups every audit under a known category', () => {
    const categories = new Set(categoryList().map((c) => c.id));
    for (const audit of auditList()) expect(categories.has(audit.category), audit.id).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/lib/cross-check.test.ts`
Expected: FAIL — `Cannot find module './cross-check'`.

- [ ] **Step 3: Write the registry reader**

```ts
// packages/website/src/lib/registry.ts
import { defaultConfig, CATEGORY_NAMES } from '@forkpoint/agent-lighthouse-core';

export interface AuditRecord {
  id: string;
  category: string;
  categoryTitle: string;
  title: string;
  description: string;
  evidenceGrade: string;
  tier: string;
  weight: number;
  priority: string;
  tags: string[];
}

export interface CategoryRecord {
  id: string;
  name: string;
  count: number;
}

/** Every registered audit, flattened, sorted by id. */
export function auditList(): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const registrations of Object.values(defaultConfig.audits)) {
    for (const reg of registrations) {
      const meta = reg.meta;
      out.push({
        id: meta.id,
        category: meta.category,
        categoryTitle: CATEGORY_NAMES[meta.category] ?? meta.category,
        title: meta.title,
        description: meta.description,
        evidenceGrade: meta.evidenceGrade ?? 'D',
        tier: meta.tier ?? 'scored',
        weight: meta.weight,
        priority: meta.defaultPriority ?? 'medium',
        tags: meta.guidance?.tags ?? [],
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** The eight categories in report order, with live counts. */
export function categoryList(): CategoryRecord[] {
  const audits = auditList();
  return defaultConfig.categories.map((category) => ({
    id: category.id,
    name: CATEGORY_NAMES[category.id] ?? category.id,
    count: audits.filter((audit) => audit.category === category.id).length,
  }));
}
```

- [ ] **Step 4: Write the cross-check**

```ts
// packages/website/src/lib/cross-check.ts

/**
 * Fail the build when the registry and the dossier set disagree.
 *
 * `scripts/check-dossiers.mjs` enforces the same rule in CI. It runs again
 * here because this is the moment a page is about to be generated: a missing
 * dossier would ship an audit with no evidence, and an orphan dossier would
 * ship a page for an audit nobody can run.
 */
export function crossCheck(registryIds: string[], dossierIds: string[]): void {
  const registry = new Set(registryIds);
  const dossiers = new Set(dossierIds);
  const missing = registryIds.filter((id) => !dossiers.has(id));
  const orphans = dossierIds.filter((id) => !registry.has(id));
  if (missing.length === 0 && orphans.length === 0) return;

  const parts: string[] = [];
  if (missing.length > 0) parts.push(`audits with no dossier: ${missing.join(', ')}`);
  if (orphans.length > 0) parts.push(`dossiers with no audit: ${orphans.join(', ')}`);
  throw new Error(`Registry and dossier set disagree — ${parts.join('; ')}`);
}
```

- [ ] **Step 5: Call it from the dossier route and add the JSON endpoint**

In `src/pages/audits/[category]/[slug].astro`, inside `getStaticPaths`, before the `return`:

```ts
  crossCheck(auditList().map((audit) => audit.id), dossiers.map((entry) => entry.id));
```

```ts
// packages/website/src/pages/audits-data.json.ts
import type { APIRoute } from 'astro';
import { auditList } from '../lib/registry';

/** Kept from the old site: anything fetching this file keeps working. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(auditList(), null, 2), {
    headers: { 'content-type': 'application/json' },
  });
```

- [ ] **Step 6: Run the tests and build**

Run: `npx vitest run packages/website && pnpm --filter @forkpoint/agent-lighthouse-website exec astro build`
Expected: PASS; build emits `dist/audits-data.json`.

- [ ] **Step 7: Commit**

```bash
git add packages/website
git commit -m "feat(website): read the live registry and fail the build on dossier drift"
```

---

## Task 3: Relative-link resolution inside dossiers

> **Implemented differently, verified forced.** Astro 7.2.4 throws on a non-empty
> `markdown.remarkPlugins` (`astro/dist/core/config/validate.js:38-56`) because
> Sätteri is the default processor and `@astrojs/markdown-remark` is an
> unfulfilled peer dependency. The plugin therefore lives in
> `src/lib/dossier-links.ts` as `dossierLinksPlugin`, registered through
> `markdown.processor: satteri({ mdastPlugins: [...] })`, and mutates nodes with
> `ctx.setProperty(node, 'url', …)` — mdast nodes are readonly under Sätteri, so
> the direct assignment below would not have worked. `resolveDossierLink` keeps
> the name and signature written here. The steps below are the original plan text.

**Files:**
- Create: `packages/website/src/lib/remark-dossier-links.ts`
- Modify: `packages/website/astro.config.mjs`
- Test: `packages/website/src/lib/remark-dossier-links.test.ts`

**Interfaces:**
- Produces: `resolveDossierLink(href: string, fromId: string, published: Set<string>): string`, and the default-exported remark plugin `remarkDossierLinks`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/lib/remark-dossier-links.test.ts
import { describe, it, expect } from 'vitest';
import { resolveDossierLink } from './remark-dossier-links';

const published = new Set(['agentic-commerce/offer-truth-consistency', 'structured-data/service-schema']);

describe('resolveDossierLink', () => {
  it('sends the policy link to the published policy page', () => {
    expect(resolveDossierLink('../../POLICY.md', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('/agent-lighthouse/policy/');
  });

  it('sends a sibling dossier link to its page', () => {
    expect(resolveDossierLink('./service-schema.md', 'structured-data/advanced-product-details', published))
      .toBe('/agent-lighthouse/audits/structured-data/service-schema/');
  });

  it('sends an unpublished dossier to GitHub', () => {
    expect(resolveDossierLink('../../merged/agentic-commerce/offer-dom-price-parity.md', 'agentic-commerce/offer-truth-consistency', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/merged/agentic-commerce/offer-dom-price-parity.md');
  });

  it('sends a repo path outside docs to GitHub', () => {
    expect(resolveDossierLink('../../../../packages/core/src/audits/REWORK-TODO.md', 'access-crawl-control/robots-directives', published))
      .toBe('https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/audits/REWORK-TODO.md');
  });

  it('leaves an absolute link alone', () => {
    const external = 'https://developers.google.com/search/docs';
    expect(resolveDossierLink(external, 'a/b', published)).toBe(external);
  });

  it('leaves an anchor alone', () => {
    expect(resolveDossierLink('#deferred', 'a/b', published)).toBe('#deferred');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/lib/remark-dossier-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the resolver and the plugin**

```ts
// packages/website/src/lib/remark-dossier-links.ts
import { visit } from 'unist-util-visit';
import { auditPath, withBase } from './routes';

const BLOB = 'https://github.com/ForkPoint/agent-lighthouse/blob/main';
/** Where a dossier sits, so a relative link can be resolved against it. */
const DOSSIER_DIR = 'docs/evidence/audits';

/**
 * Resolve one relative markdown link found inside a dossier.
 *
 * Published targets become site routes; everything else becomes a GitHub blob
 * URL, because the scope of this site is audits, the policy and the sources —
 * merged, sunset and deleted dossiers stay in the repository.
 */
export function resolveDossierLink(href: string, fromId: string, published: Set<string>): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;

  const [category] = fromId.split('/');
  const fromDir = `${DOSSIER_DIR}/${category}`;
  const segments = `${fromDir}/${href}`.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  const repoPath = stack.join('/');

  if (repoPath === 'docs/evidence/POLICY.md') return withBase('policy/');

  const dossier = /^docs\/evidence\/audits\/(.+)\.md$/.exec(repoPath);
  if (dossier && published.has(dossier[1]!)) return auditPath(dossier[1]!);

  return `${BLOB}/${repoPath}`;
}

/** Rewrite every relative link in a dossier as the page is rendered. */
export function remarkDossierLinks(published: Set<string>) {
  return () => (tree: unknown, file: { data: { astro?: { frontmatter?: { audit?: string } } } }) => {
    const fromId = file.data.astro?.frontmatter?.audit ?? '';
    if (!fromId) return;
    visit(tree as never, 'link', (node: { url: string }) => {
      node.url = resolveDossierLink(node.url, fromId, published);
    });
  };
}
```

- [ ] **Step 4: Wire the plugin into Astro**

In `astro.config.mjs`, build the published set from the dossier directory at config time and register the plugin:

```js
import { readdirSync } from 'node:fs';
import { remarkDossierLinks } from './src/lib/remark-dossier-links.ts';

const dir = new URL('../../docs/evidence/audits/', import.meta.url);
const published = new Set(
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(new URL(`${entry.name}/`, dir))
        .filter((file) => file.endsWith('.md'))
        .map((file) => `${entry.name}/${file.replace(/\.md$/, '')}`),
    ),
);

export default defineConfig({
  // …site, base, vite as in Task 1
  markdown: { remarkPlugins: [remarkDossierLinks(published)] },
});
```

- [ ] **Step 5: Add `unist-util-visit` and verify a rendered page**

Run:
```bash
pnpm --filter @forkpoint/agent-lighthouse-website add unist-util-visit
pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
grep -c 'agent-lighthouse/policy/' packages/website/dist/audits/agentic-commerce/offer-truth-consistency/index.html
```
Expected: at least `1`, and `grep -c 'POLICY.md' …/index.html` returns `0`.

- [ ] **Step 6: Run the tests and gates, then commit**

```bash
npx vitest run packages/website && pnpm typecheck && rtk err pnpm lint
git add packages/website
git commit -m "feat(website): resolve dossier links to site routes or GitHub"
```

---

## Task 4: Chrome — layouts, navigation, table of contents, brand

**Files:**
- Create: `src/layouts/Base.astro`, `src/layouts/Doc.astro`, `src/components/SiteHeader.astro`, `SidebarNav.astro`, `TableOfContents.astro`, `PrevNext.astro`, `GradeBadge.astro`, `TierBadge.astro`, `src/styles/global.css`
- Modify: `src/pages/audits/[category]/[slug].astro`
- Test: `packages/website/src/layouts/chrome.test.ts`

**Interfaces:**
- Consumes: `auditPath`, `categoryPath`, `auditList`, `categoryList`.
- Produces: `Base` props `{ title: string; description?: string }`; `Doc` props `{ title: string; description?: string; headings: Array<{ depth: number; slug: string; text: string }>; nav: Array<{ label: string; href: string; items?: Array<{ label: string; href: string }> }>; prev?: { label: string; href: string }; next?: { label: string; href: string } }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/layouts/chrome.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

/** Every .astro file under src, so a hardcoded path cannot hide in one. */
function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(full);
    return entry.name.endsWith('.astro') ? [full] : [];
  });
}

describe('chrome', () => {
  it('never hardcodes a site-absolute href', () => {
    for (const file of astroFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      const offenders = [...source.matchAll(/href="\/(?!agent-lighthouse)[a-z]/g)];
      expect(offenders.length, `${file} hardcodes a root-relative href`).toBe(0);
    }
  });

  it('gives the base layout a skip link and a theme colour', () => {
    const base = readFileSync(resolve(SRC, 'layouts/Base.astro'), 'utf8');
    expect(base).toContain('skip');
    expect(base).toContain('color-scheme');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/layouts/chrome.test.ts`
Expected: FAIL — `ENOENT` for `layouts/Base.astro`.

- [ ] **Step 3: Write the stylesheet with the brand tokens**

```css
/* packages/website/src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-brand: #4f46e5;
  --color-brand-soft: #6366f1;
  --color-surface: #020617;
  --color-surface-raised: #0f172a;
  --color-border-subtle: #1e293b;
}

:root { color-scheme: dark; }

html { scroll-behavior: smooth; }
body { background: var(--color-surface); color: #e2e8f0; }
```

Values are taken from the existing page: indigo-600 accent, slate-950 surface, slate-900 raised, slate-800 borders.

- [ ] **Step 4: Write `Base.astro`**

```astro
---
import '../styles/global.css';
import SiteHeader from '../components/SiteHeader.astro';
import { withBase } from '../lib/routes';

interface Props { title: string; description?: string }
const { title, description = 'Lighthouse-style audits for AI agents and the agentic web.' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href={withBase('og-image.svg')} />
  </head>
  <body class="min-h-screen antialiased">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:p-3">Skip to content</a>
    <SiteHeader />
    <main id="main"><slot /></main>
    <footer class="border-t border-border-subtle mt-16 py-8 text-center text-xs text-slate-500">
      Apache-2.0 · <a class="underline" href="https://github.com/ForkPoint/agent-lighthouse">Source on GitHub</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 5: Write `SidebarNav.astro`, `TableOfContents.astro`, `PrevNext.astro`, `GradeBadge.astro`, `TierBadge.astro`, `SiteHeader.astro`**

`SidebarNav` renders the `nav` prop as a `<nav><ul>` tree, marking the entry whose `href` equals `Astro.url.pathname` with `aria-current="page"`. `TableOfContents` renders `headings` filtered to `depth === 2 || depth === 3` as anchor links to `#${slug}`. `PrevNext` renders two optional links in a flex row. `GradeBadge` maps `A→emerald`, `B→indigo`, `C→amber`, `D→slate` to a pill. `TierBadge` maps `scored→brand`, `informative→slate`, `experimental→amber`. `SiteHeader` carries the wordmark, links to `/audits/`, `/docs/quickstart/`, `/policy/`, and the search trigger slot (filled in Task 10).

- [ ] **Step 6: Write `Doc.astro` and use it in the dossier route**

`Doc.astro` composes `Base`, a three-column grid (`SidebarNav`, `<article class="prose">`, `TableOfContents`) collapsing to one column under `lg`, and `PrevNext` at the foot. The dossier route passes the audit's registry record into a header block showing `GradeBadge`, `TierBadge`, weight, priority, and a link to `source_file` on GitHub, then renders `<Content />` inside the article.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run packages/website && pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
git add packages/website
git commit -m "feat(website): hand-built chrome — layouts, nav, table of contents, brand"
```

---

## Task 5: Audit explorer and category indexes

**Files:**
- Create: `src/pages/audits/index.astro`, `src/pages/categories/[category].astro`, `src/components/AuditCard.astro`, `src/islands/audit-explorer.ts`
- Test: `packages/website/src/islands/audit-explorer.test.ts`

**Interfaces:**
- Consumes: `auditList()`, `categoryList()`, `auditPath()`.
- Produces: `filterAudits(audits: AuditRecord[], query: { text: string; category: string; tier: string }): AuditRecord[]` — exported so it is testable without a DOM.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/islands/audit-explorer.test.ts
import { describe, it, expect } from 'vitest';
import { filterAudits } from './audit-explorer';
import type { AuditRecord } from '../lib/registry';

const record = (over: Partial<AuditRecord>): AuditRecord => ({
  id: 'a/b', category: 'a', categoryTitle: 'A', title: 'Title', description: 'Description',
  evidenceGrade: 'B', tier: 'scored', weight: 0.6, priority: 'medium', tags: [], ...over,
});

describe('filterAudits', () => {
  const audits = [
    record({ id: 'agentic-commerce/offer-truth-consistency', title: 'Offer Truth Consistency', category: 'agentic-commerce', tags: ['price'] }),
    record({ id: 'access-crawl-control/robots-directives', title: 'Robots Directives', category: 'access-crawl-control', tier: 'informative' }),
  ];

  it('matches on title, id and tag', () => {
    expect(filterAudits(audits, { text: 'offer', category: 'all', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: 'robots-directives', category: 'all', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: 'price', category: 'all', tier: 'all' })).toHaveLength(1);
  });

  it('filters by category and tier independently', () => {
    expect(filterAudits(audits, { text: '', category: 'agentic-commerce', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: '', category: 'all', tier: 'informative' })).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    expect(filterAudits(audits, { text: '', category: 'all', tier: 'all' })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/islands/audit-explorer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the island**

```ts
// packages/website/src/islands/audit-explorer.ts
import type { AuditRecord } from '../lib/registry';

export interface ExplorerQuery { text: string; category: string; tier: string }

/** The filter behind the explorer. Pure, so it is tested without a DOM. */
export function filterAudits(audits: AuditRecord[], query: ExplorerQuery): AuditRecord[] {
  const text = query.text.trim().toLowerCase();
  return audits.filter((audit) => {
    if (query.category !== 'all' && audit.category !== query.category) return false;
    if (query.tier !== 'all' && audit.tier !== query.tier) return false;
    if (text === '') return true;
    const haystack = [audit.id, audit.title, audit.description, ...audit.tags].join(' ').toLowerCase();
    return haystack.includes(text);
  });
}

/** Bind the filter to the page. Called from the explorer page's inline script. */
export function mountExplorer(audits: AuditRecord[]): void {
  const input = document.querySelector<HTMLInputElement>('#audit-search');
  const cards = [...document.querySelectorAll<HTMLElement>('[data-audit-id]')];
  const state: ExplorerQuery = { text: '', category: 'all', tier: 'all' };

  const apply = () => {
    const visible = new Set(filterAudits(audits, state).map((audit) => audit.id));
    for (const card of cards) card.hidden = !visible.has(card.dataset['auditId'] ?? '');
    const count = document.querySelector('#audit-count');
    if (count) count.textContent = String(visible.size);
  };

  input?.addEventListener('input', () => { state.text = input.value; apply(); });
  for (const pill of document.querySelectorAll<HTMLElement>('[data-filter]')) {
    pill.addEventListener('click', () => {
      const kind = pill.dataset['filter'] as 'category' | 'tier';
      state[kind] = pill.dataset['value'] ?? 'all';
      for (const sibling of document.querySelectorAll(`[data-filter="${kind}"]`)) {
        sibling.setAttribute('aria-pressed', String(sibling === pill));
      }
      apply();
    });
  }
  apply();
}
```

- [ ] **Step 4: Write the pages**

`/audits/` renders every `AuditCard` server-side — so the list works with JavaScript disabled and Pagefind can index it — then hydrates the filter with `mountExplorer`. `/categories/[category]/` uses `getStaticPaths` over `categoryList()` and renders that category's cards with its description.

- [ ] **Step 5: Verify page counts and commit**

```bash
pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
find packages/website/dist/categories -name index.html | wc -l   # expect 8
npx vitest run packages/website
git add packages/website
git commit -m "feat(website): audit explorer and per-category indexes"
```

---

## Task 6: Docs pages from existing markdown

**Files:**
- Create: `src/lib/markdown-slice.ts`, `src/pages/docs/[slug].astro`, `src/content.config.ts` (extend with a `guides` collection)
- Test: `packages/website/src/lib/markdown-slice.test.ts`

**Interfaces:**
- Produces: `sliceSection(markdown: string, heading: string): string` — returns the body under a `## ` heading, up to the next `## `, heading line excluded; throws when the heading is absent. `DOC_SECTIONS: Array<{ slug: string; title: string; file: string; heading?: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/lib/markdown-slice.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sliceSection, DOC_SECTIONS } from './markdown-slice';

const REPO = resolve(__dirname, '../../../..');

describe('sliceSection', () => {
  it('returns the body under a heading', () => {
    const md = '# Title\n\n## One\n\nfirst\n\n## Two\n\nsecond\n';
    expect(sliceSection(md, '## One').trim()).toBe('first');
  });

  it('throws when the heading is gone', () => {
    expect(() => sliceSection('## Other\n', '## One')).toThrow(/## One/);
  });
});

describe('DOC_SECTIONS', () => {
  it('names a real file for every section', () => {
    for (const section of DOC_SECTIONS) {
      expect(() => readFileSync(resolve(REPO, section.file), 'utf8'), section.slug).not.toThrow();
    }
  });

  // A README edit that renames a heading must fail here, not empty a page.
  it('finds every heading it slices', () => {
    for (const section of DOC_SECTIONS) {
      if (!section.heading) continue;
      const source = readFileSync(resolve(REPO, section.file), 'utf8');
      expect(() => sliceSection(source, section.heading!), `${section.slug} → ${section.heading}`).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/lib/markdown-slice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the slicer and the section table**

```ts
// packages/website/src/lib/markdown-slice.ts

/** The body under one `## ` heading, up to the next one. */
export function sliceSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start === -1) throw new Error(`Heading not found: ${heading}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * Where each docs page gets its prose.
 *
 * Reuse first: eight of eleven sections render markdown that already exists.
 * The three with no source anywhere are written as files in Task 7 rather than
 * being extracted into components, so they stay reusable.
 */
export const DOC_SECTIONS = [
  { slug: 'quickstart', title: 'Quickstart', file: 'README.md', heading: '## ⚡ Quickstart' },
  { slug: 'architecture', title: 'Packages & architecture', file: 'README.md', heading: '## 📦 Packages & Architecture' },
  { slug: 'sdk', title: 'Node.js / TypeScript SDK', file: 'README.md', heading: '## 💻 Programmatic Node.js / TypeScript SDK' },
  { slug: 'mcp', title: 'MCP server', file: 'README.md', heading: '## 🤖 Model Context Protocol (MCP) Server' },
  { slug: 'ci', title: 'GitHub Actions CI', file: 'README.md', heading: '## 🛡️ GitHub Actions CI' },
  { slug: 'share', title: 'Share your score', file: 'README.md', heading: '## 📣 Share Your Score' },
  { slug: 'badge', title: 'Badge', file: 'docs/BADGE.md' },
  { slug: 'benchmark', title: 'Benchmark', file: 'docs/BENCHMARK.md' },
  { slug: 'scoring', title: 'Scoring', file: 'docs/SCORING.md' },
  { slug: 'cli', title: 'CLI reference', file: 'docs/CLI.md' },
  { slug: 'config', title: 'Configuration', file: 'docs/CONFIG.md' },
] as const;
```

- [ ] **Step 4: Write the docs route**

`src/pages/docs/[slug].astro` uses `getStaticPaths` over `DOC_SECTIONS`, reads the file with `node:fs`, applies `sliceSection` when `heading` is set, renders the markdown to HTML with Astro's `markdown` renderer (`import { marked } from 'marked'` is **not** used — use `astro:content`'s `render` where possible, otherwise `@astrojs/markdown-remark`'s `createMarkdownProcessor`), and wraps it in `Doc.astro` with `DOC_SECTIONS` as the sidebar nav.

- [ ] **Step 5: Verify and commit**

The three sections whose files do not exist yet (`SCORING.md`, `CLI.md`, `CONFIG.md`) fail the `DOC_SECTIONS` file test. Create them as one-line placeholders **only** if Task 7 is not executed immediately after; otherwise run Task 7 first and commit both together.

```bash
npx vitest run packages/website
git add packages/website
git commit -m "feat(website): docs pages rendered from existing markdown"
```

---

## Task 7: The three docs pages that have no markdown source

**Files:**
- Create: `docs/SCORING.md`, `docs/CLI.md`, `docs/CONFIG.md`
- Read for content: `packages/website/index.html` lines 792–6570 (sections `#scoring`, `#cli`, `#config`), `packages/cli/src/index.ts` (flags), `packages/core/src/types.ts` (`ScanOptions`), `docs/evidence/POLICY.md` (grades)
- Test: `packages/website/src/lib/docs-content.test.ts`

**Interfaces:**
- Consumes: `DOC_SECTIONS` from Task 6.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/lib/docs-content.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultConfig } from '@forkpoint/agent-lighthouse-core';

const REPO = resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(resolve(REPO, file), 'utf8');

describe('docs/SCORING.md', () => {
  it('states the weight law and every tier', () => {
    const scoring = read('docs/SCORING.md');
    for (const tier of ['scored', 'informative', 'experimental']) expect(scoring).toContain(tier);
    for (const grade of ['A', 'B', 'C', 'D']) expect(scoring).toMatch(new RegExp(`\\b${grade}\\b`));
  });
});

describe('docs/CLI.md', () => {
  it('documents every flag the CLI accepts', () => {
    const cli = read('docs/CLI.md');
    const source = read('packages/cli/src/index.ts');
    const flags = [...source.matchAll(/'--([a-z-]+)'/g)].map((m) => `--${m[1]}`);
    for (const flag of new Set(flags)) expect(cli, `undocumented flag ${flag}`).toContain(flag);
  });
});

describe('docs/CONFIG.md', () => {
  it('names every category id', () => {
    const config = read('docs/CONFIG.md');
    for (const category of defaultConfig.categories) expect(config).toContain(category.id);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/lib/docs-content.test.ts`
Expected: FAIL — `ENOENT: docs/SCORING.md`.

- [ ] **Step 3: Write `docs/SCORING.md`**

Content: the weight law (`weight = weightForGrade(grade, tier)`), the grade table from `docs/evidence/POLICY.md`, the three tiers and what each does to a score, category weighting, and how an `na` result is excluded rather than counted as a failure. Source the prose from `index.html` section `#scoring` and reconcile every number against `packages/core/src/scorer.ts`.

- [ ] **Step 4: Write `docs/CLI.md`**

Content: installation, the invocation form, and a flag table with one row per flag, each with its default. Read the flags out of `packages/cli/src/index.ts` — the test above fails on any flag left undocumented.

- [ ] **Step 5: Write `docs/CONFIG.md`**

Content: the config file shape, `ScanOptions` fields with types and defaults, the eight category ids and what each covers, and how `--categories` and `--experimental` interact with them.

- [ ] **Step 6: Run the tests, build, commit**

```bash
npx vitest run packages/website && pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
git add docs/SCORING.md docs/CLI.md docs/CONFIG.md packages/website
git commit -m "docs: scoring, CLI and configuration references as reusable markdown"
```

---

## Task 8: Policy page and the sources browser

**Files:**
- Create: `src/pages/policy.astro`, `src/pages/sources.astro`, `src/islands/sources-table.ts`, `src/pages/sources.json.ts`
- Test: `packages/website/src/islands/sources-table.test.ts`

**Interfaces:**
- Produces: `filterSources(sources: SourceRecord[], text: string, kind: string): SourceRecord[]`, `SourceRecord = { id: string; title: string; url: string; publisher: string; kind: string; verified: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/islands/sources-table.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { filterSources, type SourceRecord } from './sources-table';

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/evidence/sources.json'), 'utf8'));

describe('filterSources', () => {
  const sources: SourceRecord[] = [
    { id: 's1', title: 'MCP Specification', url: 'https://example.test/a', publisher: 'Model Context Protocol', kind: 'spec', verified: '2026-08-20' },
    { id: 's2', title: 'Crawler study', url: 'https://example.test/b', publisher: 'Vercel', kind: 'study', verified: '2026-08-20' },
  ];

  it('matches title and publisher', () => {
    expect(filterSources(sources, 'vercel', 'all')).toHaveLength(1);
    expect(filterSources(sources, 'specification', 'all')).toHaveLength(1);
  });

  it('filters by kind', () => {
    expect(filterSources(sources, '', 'spec')).toHaveLength(1);
  });

  it('parses the real registry', () => {
    expect(Object.keys(raw).length).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/islands/sources-table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`sources-table.ts` exports `SourceRecord`, `filterSources` and `mountSourcesTable()`, which fetches `withBase('sources.json')` on first paint and renders rows into a `<tbody>`; the 465 KB payload is never inlined. `src/pages/sources.json.ts` is an `APIRoute` that reads `docs/evidence/sources.json` from disk and returns it. `src/pages/policy.astro` renders the `policy` collection entry inside `Doc.astro`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
test -f packages/website/dist/policy/index.html && test -f packages/website/dist/sources.json
npx vitest run packages/website
git add packages/website
git commit -m "feat(website): policy page and the sources registry browser"
```

---

## Task 9: Landing page, badge generator, report viewer

**Files:**
- Create: `src/pages/index.astro`, `src/islands/badge-generator.ts`, `src/islands/report-viewer.ts`
- Read for content: `packages/website/index.html` — hero and showcase markup, badge functions at lines 6828–6852, viewer functions at lines 6754–6814
- Test: `packages/website/src/islands/badge-generator.test.ts`

**Interfaces:**
- Produces: `badgeColor(score: number): string`, `badgeMarkdown(score: number, url: string): string`, `summarize(report: unknown): { score: number; categories: Array<{ name: string; score: number }> }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/islands/badge-generator.test.ts
import { describe, it, expect } from 'vitest';
import { badgeColor, badgeMarkdown } from './badge-generator';

describe('badgeColor', () => {
  it('maps each score band to its colour', () => {
    expect(badgeColor(95)).toBe('22c55e');
    expect(badgeColor(90)).toBe('22c55e');
    expect(badgeColor(89)).toBe('4f46e5');
    expect(badgeColor(70)).toBe('4f46e5');
    expect(badgeColor(69)).toBe('f59e0b');
    expect(badgeColor(50)).toBe('f59e0b');
    expect(badgeColor(49)).toBe('ef4444');
    expect(badgeColor(0)).toBe('ef4444');
  });
});

describe('badgeMarkdown', () => {
  it('encodes the score and links the scanned site', () => {
    const md = badgeMarkdown(87, 'https://example.com');
    expect(md).toContain('Agent%20Lighthouse-87%2F100-4f46e5');
    expect(md).toContain('https://example.com');
  });
});
```

The bands come from `docs/BADGE.md`, which is the published contract.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/islands/badge-generator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Port the three islands**

Lift the logic from `index.html` verbatim where it is correct, converting to typed modules with the pure parts exported. `report-viewer.ts` keeps the drag-and-drop behaviour and the JSON rendering; it must not `eval` or inject unescaped report content — reuse the existing `escapeHtml` and keep it exported for tests.

- [ ] **Step 4: Write the landing page**

`src/pages/index.astro` composes `Base` with the hero, live counts from `categoryList()`, the showcase, and a link into `/audits/`. The badge generator and the report viewer mount on this page.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run packages/website && pnpm --filter @forkpoint/agent-lighthouse-website exec astro build
git add packages/website
git commit -m "feat(website): landing page with the badge generator and report viewer"
```

---

## Task 10: Search

**Files:**
- Create: `src/components/SearchDialog.astro`, `src/islands/search.ts`
- Modify: `src/components/SiteHeader.astro`, `packages/website/package.json` (build script already runs Pagefind from Task 1)
- Test: `packages/website/src/islands/search.test.ts`

**Interfaces:**
- Produces: `searchShortcut(event: KeyboardEvent): boolean` — true when the event should open the dialog (`/` outside an input, or `⌘K` / `Ctrl+K`).

- [ ] **Step 1: Write the failing test**

```ts
// packages/website/src/islands/search.test.ts
import { describe, it, expect } from 'vitest';
import { searchShortcut } from './search';

const event = (over: Partial<KeyboardEvent> & { target?: unknown }) =>
  ({ key: '/', metaKey: false, ctrlKey: false, target: { tagName: 'BODY' }, ...over }) as unknown as KeyboardEvent;

describe('searchShortcut', () => {
  it('opens on slash outside an input', () => {
    expect(searchShortcut(event({}))).toBe(true);
  });

  it('ignores slash typed into an input', () => {
    expect(searchShortcut(event({ target: { tagName: 'INPUT' } }))).toBe(false);
  });

  it('opens on cmd-k and ctrl-k', () => {
    expect(searchShortcut(event({ key: 'k', metaKey: true }))).toBe(true);
    expect(searchShortcut(event({ key: 'k', ctrlKey: true }))).toBe(true);
  });

  it('ignores every other key', () => {
    expect(searchShortcut(event({ key: 'a' }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/website/src/islands/search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`search.ts` exports `searchShortcut` and `mountSearch()`, which lazily `import(withBase('pagefind/pagefind.js'))` on first open, queries it, and renders results as links. `SearchDialog.astro` is a `<dialog>` with an input and a results list, opened from the header button and by the shortcut. Add `data-pagefind-body` to the article element in `Doc.astro` so Pagefind indexes dossier prose, and `data-pagefind-filter="category"` / `"grade"` on the dossier header.

- [ ] **Step 4: Verify the index is built**

```bash
pnpm --filter @forkpoint/agent-lighthouse-website build
test -d packages/website/dist/pagefind
grep -rl "offer-truth-consistency" packages/website/dist/pagefind | head -1
```
Expected: the directory exists and the term is in the index.

- [ ] **Step 5: Commit**

```bash
git add packages/website
git commit -m "feat(website): Pagefind search over dossiers and docs"
```

---

## Task 11: Link reports at the published evidence

**Files:**
- Modify: `packages/core/src/audit.ts` (add `evidenceUrl` to the result), `packages/core/src/types.ts`, `packages/core/src/schemas.ts`, `packages/report/src/html-generator.ts`, and the 68 audit files whose `guidance.docsUrl` points at a dossier blob URL
- Test: `packages/core/src/__tests__/evidence-url.test.ts`

**Interfaces:**
- Produces: `evidenceUrl(id: string): string` exported from `packages/core/src/audit.ts`.

**Correction to the spec.** The spec said `guidance.docsUrl` would move to the website for every audit. The registry disagrees: of 161 audits declaring `docsUrl`, only **68** point at their own dossier; the other 93 point at an external specification (`https://platform.openai.com/docs/bots`, an IETF draft, a vendor bot page) that a reader needs in order to apply the fix. Overwriting those would destroy information. So: a derived `evidenceUrl` is added for **every** audit — the URL is a pure function of the id and needs no per-audit field — and only the 68 self-referential `docsUrl` values are rewritten to the website.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/__tests__/evidence-url.test.ts
import { describe, it, expect } from 'vitest';
import { evidenceUrl } from '../audit';
import { defaultConfig } from '../index';

describe('evidenceUrl', () => {
  it('derives the published page from the audit id', () => {
    expect(evidenceUrl('agentic-commerce/offer-truth-consistency')).toBe(
      'https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
    );
  });

  it('gives every registered audit a URL that names its own id', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        expect(evidenceUrl(reg.meta.id), reg.meta.id).toContain(`/audits/${reg.meta.id}/`);
      }
    }
  });

  // A docsUrl pointing at raw markdown is a link a reader cannot read comfortably.
  it('leaves no docsUrl pointing at a dossier blob URL', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        expect(reg.meta.guidance?.docsUrl ?? '', reg.meta.id).not.toContain('blob/main/docs/evidence/audits');
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/core/src/__tests__/evidence-url.test.ts`
Expected: FAIL — `evidenceUrl` is not exported, and 68 audits still carry blob URLs.

- [ ] **Step 3: Add `evidenceUrl` and carry it on the result**

```ts
// packages/core/src/audit.ts

/** Where an audit's evidence dossier is published. A pure function of the id. */
export function evidenceUrl(id: string): string {
  return `https://forkpoint.github.io/agent-lighthouse/audits/${id}/`;
}
```

In `toCheckResult`, alongside `docsUrl`, add `evidenceUrl: evidenceUrl(meta.id)`. Extend `CheckResult['details']` in `types.ts` and the `details` schema in `schemas.ts` with `evidenceUrl?: string`.

- [ ] **Step 4: Rewrite the 68 self-referential docsUrl values**

```bash
cd packages/core/src/audits
perl -0pi -e 's{https://github\.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/([a-z-]+)/([a-z0-9-]+)\.md}{https://forkpoint.github.io/agent-lighthouse/audits/$1/$2/}g' */*.ts
```

- [ ] **Step 5: Render the link in the HTML report**

In `packages/report/src/html-generator.ts`, after the `c.fix` block, add:

```ts
                      ${c.details?.evidenceUrl ? `
                        <a href="${escapeHtml(c.details.evidenceUrl)}" target="_blank" rel="noopener"
                           class="inline-block underline text-indigo-600 dark:text-indigo-400">Why this audit exists — the evidence</a>
                      ` : ''}
```

- [ ] **Step 6: Run the tests and gates, then commit**

```bash
AL_SKIP_NETWORK=1 pnpm test && pnpm typecheck && rtk err pnpm lint
git add packages/core packages/report
git commit -m "feat(core)!: link every audit result at its published evidence page"
```

---

## Task 12: Ship it — CI, deploy, deletions, changeset

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`, `.github/workflows/ci.yml`
- Delete: `packages/website/index.html`, `packages/website/audits-data.json`, `scripts/build-docs-data.ts`, `scripts/build-docs-data.test.ts`
- Create: `.changeset/website-astro.md`
- Test: `packages/website/src/build-smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
// packages/website/src/build-smoke.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditList } from './lib/registry';

const DIST = resolve(__dirname, '../dist');
const built = existsSync(DIST);

describe.skipIf(!built)('built site', () => {
  it('emits one page per audit', () => {
    const pages = readdirSync(resolve(DIST, 'audits'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => readdirSync(resolve(DIST, 'audits', entry.name)));
    expect(pages.length).toBe(auditList().length);
  });

  it('renders a known dossier with its mechanism section', () => {
    const page = readFileSync(
      resolve(DIST, 'audits/agentic-commerce/offer-truth-consistency/index.html'),
      'utf8',
    );
    expect(page).toContain('Claimed mechanism');
    expect(page).not.toContain('POLICY.md');
  });

  it('ships a search index', () => {
    expect(existsSync(resolve(DIST, 'pagefind'))).toBe(true);
  });
});
```

The suite skips when `dist` is absent, so a plain `pnpm test` on a fresh clone stays green; CI builds first, so it runs there.

- [ ] **Step 2: Update the deploy workflow**

Replace the `Upload artifact` step's input and add build steps before it:

```yaml
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @forkpoint/agent-lighthouse-core build
      - run: pnpm --filter @forkpoint/agent-lighthouse-website build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './packages/website/dist'
```

- [ ] **Step 3: Build the website in CI**

In `.github/workflows/ci.yml`, after the existing build step, add `- run: pnpm --filter @forkpoint/agent-lighthouse-website build`, then run the test suite so the smoke test sees `dist`.

- [ ] **Step 4: Delete what the site replaces**

```bash
git rm packages/website/index.html packages/website/audits-data.json
git rm scripts/build-docs-data.ts scripts/build-docs-data.test.ts
```

Then remove the `scripts/**` include from `vitest.config.ts` only if no other script test remains — check with `ls scripts/*.test.ts` first.

- [ ] **Step 5: Write the changeset**

```markdown
---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
---

Every audit result now carries `details.evidenceUrl`, the address of that
audit's evidence dossier on the documentation site, and the HTML report links
it. The 68 audits whose `docsUrl` pointed at raw markdown on GitHub now point
at the rendered page; the 93 that point at an external specification are
unchanged.
```

- [ ] **Step 6: Full verification**

```bash
pnpm install
pnpm --filter @forkpoint/agent-lighthouse-core build
pnpm --filter @forkpoint/agent-lighthouse-website build
AL_SKIP_NETWORK=1 pnpm test
pnpm typecheck
rtk err pnpm lint
node scripts/check-dossiers.mjs
```
Expected: all green; `check-dossiers` still reports 215 audits and 215 dossiers.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(website): replace the single-page site with the Astro build"
```

---

## Self-review

**Spec coverage.** Content scope → Tasks 1, 8. Plain Astro with hand-built chrome → Task 4. Pagefind → Task 10. Reuse-in-place → Tasks 1, 6 (loaders point outside the package; nothing is copied). Link resolution → Task 3. Routes → Tasks 1, 5, 6, 8, 9. `docsUrl` → Task 11, with the correction recorded there. CI and deploy → Task 12. Tests → each task carries its own; the build smoke test is Task 12.

**Known deviation from the spec.** `docsUrl` is not uniformly rewritten; see the correction in Task 11.

**Ordering.** Task 6 depends on files created in Task 7. Execute 7 before 6, or accept one failing test between them; the plan says so in Task 6, Step 5.
