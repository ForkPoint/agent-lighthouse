# Website rebuild — Astro, with every audit dossier published

**Date:** 2026-08-23
**Status:** approved design, awaiting implementation plan
**Supersedes:** the hand-maintained `packages/website/index.html` and `scripts/build-docs-data.ts`

## Problem

The project has 215 audits. Each one has an evidence dossier under `docs/evidence/audits/<category>/<slug>.md` — 2.3 MB of mechanism, cited sources, competitor coverage, implementation deviations and deferred work — and a CI check (`scripts/check-dossiers.mjs`) that guarantees every audit has exactly one dossier and no dossier is an orphan.

None of that is published. The website is a single 478 KB `index.html` carrying fifteen anchored sections and an audit explorer fed by an `EMBEDDED_AUDITS` array that a script rewrites in place. The explorer links each audit to a GitHub blob URL, so the evidence a reader wants is served as raw markdown on another domain, behind a click most readers never make.

Two consequences. The strongest asset the project has — an evidence trail per audit — is invisible to anyone who has not cloned the repo. And the page itself has outgrown its shape: one file, CDN Tailwind, no build, an embedded copy of the registry that only a bespoke script keeps in step.

## Goals

1. Publish every audit dossier as a page, **rendered from the file that already exists**. No copy, no fork, no rewrite.
2. Replace the single page with an Astro site: real routes, a real build, real tests.
3. Make drift impossible. The site reads the live registry and the dossier files; a mismatch fails the build rather than shipping a stale page.
4. Point each audit's `guidance.docsUrl` at its published page, so a CLI run and an HTML report link a user to a rendered document.

## Non-goals

- Publishing `docs/evidence/merged/`, `sunset/`, `deletions/` or `proposals/`. Links into them resolve to GitHub.
- A content management system, authentication, comments, or per-version documentation.
- Redesigning the brand. The existing dark palette carries over.
- Rewriting dossier prose. The markdown on disk is the deliverable; the site renders it.

## Decisions

| Decision | Choice | Why |
| :-- | :-- | :-- |
| Content scope | Audit dossiers + `POLICY.md` + `sources.json` | The evidence a reader needs to judge a grade. Merged and sunset dossiers are repo history, not product documentation. |
| Framework | Plain Astro, hand-built chrome | Exact brand fidelity, no framework shell to fight. Sidebar, table of contents, prev/next and mobile nav are ours to write. |
| Search | Pagefind | Indexes the built HTML after `astro build`. Static, no service, no key. |
| `guidance.docsUrl` | Points at the website | A report should link to a rendered page, not to raw markdown. |
| Docs prose | Reuse existing markdown; author markdown only where none exists | The same instructions must not live in two places. |
| Styling | Tailwind v4, compiled | The CDN build is not a production dependency. |

## Architecture

### Content sources

Two, both read at build time, neither copied into the package.

**Dossiers and policy** come from Astro content collections with a `glob()` loader whose `base` points outside the package:

```ts
// packages/website/src/content.config.ts
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
```

The schema is not decoration: a dossier whose frontmatter drifts fails the build with the file name and the offending field.

**Registry metadata** comes from the package itself. `packages/website` takes `@forkpoint/agent-lighthouse-core` as a workspace dependency and imports `defaultConfig` and `CATEGORY_NAMES` directly, so the audit list, weights, tiers, grades, priorities and guidance are read from the code that runs a scan. `scripts/build-docs-data.ts`, `scripts/build-docs-data.test.ts` and the `EMBEDDED_AUDITS` rewriting are deleted.

**The cross-check runs at build.** Every registry audit must have a dossier, every dossier must have a registry audit, and the grades must agree — the same three rules `check-dossiers.mjs` enforces in CI, applied again where a page is about to be generated. A failure throws with both lists.

### Link resolution

Dossiers carry 127 relative markdown links. They are rewritten at render time by a remark plugin, on the rendered output only:

| Target | Rewrite |
| :-- | :-- |
| `../../POLICY.md` (60 links) | `/policy/` |
| A sibling dossier, e.g. `./service-schema.md` | `/audits/<category>/<slug>/` |
| Anything under `deletions/`, `merged/`, `sunset/`, or a repo path such as `packages/core/src/audits/REWORK-TODO.md` | `https://github.com/ForkPoint/agent-lighthouse/blob/main/<repo-path>` |

The plugin resolves a target against the published set. An unpublished target becomes a GitHub link rather than a 404; an unresolvable one fails the build rather than shipping a dead link.

### Routes

| Route | Count | Source |
| :-- | --: | :-- |
| `/` | 1 | Bespoke landing page: hero, category overview, showcase |
| `/docs/<section>/` | 11 | Markdown, reused where it exists (see below) |
| `/audits/` | 1 | Explorer island over generated registry data |
| `/audits/<category>/<slug>/` | 215 | Dossier collection |
| `/categories/<category>/` | 8 | Registry, grouped |
| `/policy/` | 1 | `docs/evidence/POLICY.md` |
| `/sources/` | 1 | `sources.json`, fetched on demand |
| `/audits-data.json` | 1 | Static endpoint, kept for compatibility |
| `/404` | 1 | — |

`base` is `/agent-lighthouse`, so every internal link is built through `import.meta.env.BASE_URL`. A hardcoded absolute path is a bug the link test catches.

### Docs sections and their sources

Reuse first. Only three sections have no markdown anywhere, and those get `.md` files written into the repo so they are reusable afterwards rather than trapped in HTML again.

| Section | Source |
| :-- | :-- |
| Quickstart | `README.md` § Quickstart |
| Architecture | `README.md` § Packages & Architecture |
| SDK | `README.md` § Programmatic Node.js / TypeScript SDK |
| MCP | `README.md` § MCP Server, plus `packages/mcp/README.md` |
| CI | `README.md` § GitHub Actions CI |
| Badge | `docs/BADGE.md` + the generator island |
| Benchmark | `docs/BENCHMARK.md` |
| Launch kit | `docs/PROMOTION.md` |
| Scoring | **new** `docs/SCORING.md`, extracted from `index.html` and reconciled with `docs/evidence/POLICY.md` |
| CLI reference | **new** `docs/CLI.md`, extracted from `index.html`, flags reconciled against the CLI source |
| Configuration | **new** `docs/CONFIG.md`, extracted from `index.html`, reconciled against `ScanOptions` |

Sections extracted from `README.md` are addressed by heading, not by line number, and a test asserts each named heading still exists — a README edit that renames a heading fails the build instead of emptying a page.

### Components

Small files, one purpose each.

- `layouts/Base.astro` — head, theme, skip link, header, footer
- `layouts/Doc.astro` — sidebar, content, table of contents, prev/next
- `components/` — `SiteHeader`, `SidebarNav`, `TableOfContents`, `PrevNext`, `SearchDialog`, `AuditCard`, `GradeBadge`, `TierBadge`, `CategoryPills`
- `islands/` — three, vanilla TypeScript, no UI framework: `AuditExplorer` (filter and sort), `BadgeGenerator` (ported), `SourcesTable` (fetches `sources.json` on demand rather than embedding 465 KB)

The report viewer — the drag-and-drop panel that renders a scan's JSON — ports as a fourth island, unchanged in behaviour.

### Search

`pagefind` runs after `astro build` over `dist`, emitting `dist/pagefind`. `SearchDialog` loads the index on first open and binds `/` and `⌘K`. Dossier pages are indexed with their category and grade as filters.

## docsUrl migration

Every audit whose meta carries `guidance.docsUrl` moves from

```
https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/<category>/<slug>.md
```

to

```
https://forkpoint.github.io/agent-lighthouse/audits/<category>/<slug>/
```

A vitest in core pins the pattern against each audit's own id, so a rename cannot silently orphan a link. Each dossier page carries a "view source" link back to GitHub and a link to the `source_file` the frontmatter names, so nothing that was reachable becomes unreachable.

## CI and deployment

`deploy-pages.yml` gains real steps: install pnpm, install dependencies, build `@forkpoint/agent-lighthouse-core` (the site imports it), build the website, run Pagefind, upload `packages/website/dist`.

`ci.yml` builds the website too. A site that does not build fails the pull request rather than the deploy.

## Testing

| Test | Asserts |
| :-- | :-- |
| Frontmatter parse | All 215 dossiers satisfy the collection schema |
| Registry ↔ dossier | 1:1, with grades in agreement — the build-time check, run as a unit test too |
| Route generation | 215 audit routes, 8 category routes, one per docs section |
| Link resolution | Every relative dossier link resolves to a published route or a GitHub URL; none is left dangling |
| README headings | Every heading a docs page slices still exists |
| `docsUrl` pin | Each audit's `docsUrl` matches its own id |
| Build smoke | `dist/audits/agentic-commerce/offer-truth-consistency/index.html` exists and contains the mechanism section |

## Migration order

1. Scaffold the Astro package and prove the pipeline end to end on the dossiers — collection, cross-check, 215 routes, link rewriting.
2. Landing page and chrome.
3. Docs sections, reused sources first, then the three new markdown files.
4. Islands: explorer, badge generator, sources table, report viewer.
5. Search, deploy workflow, `docsUrl` migration.
6. Delete `index.html`, `audits-data.json` as a checked-in file, and `scripts/build-docs-data.*`.

The old page keeps serving until step 6. Nothing is deleted before its replacement passes tests.

## Risks

- **Base path.** Every internal link must go through `BASE_URL`; a missed one 404s only in production. Mitigated by the link test and by a build-time crawl of emitted HTML.
- **Loader outside the package root.** The `glob()` base points at `../../docs/evidence`. This works, and it is the mechanism that makes reuse-in-place possible, but it means the website build depends on repo layout. A moved dossier directory breaks the build loudly, which is the correct failure.
- **Page count.** 215 dossier pages plus categories and docs is a larger build than today's single file. Astro handles it, but build time moves from zero to tens of seconds, and CI gains that cost on every pull request.
- **`sources.json` is 465 KB.** It is never embedded; the sources page fetches it. A reader on a slow connection pays only when they open that page.
