---
audit: machine-discovery/internal-cross-linking
audit_id: "10.11"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/internal-cross-linking.ts
slug: internal-cross-linking
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# internal-cross-linking (`10.11`)

> generative-engine · source `internal-cross-linking.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI engines use internal link structure to understand topic relationships and site authority. Pages without internal links are treated as isolated content.

## Code review findings (2026-08-20, 11-agent pass)

Falsy as implemented. `extractInternalLinks` scans every `<a href>` in the document, so a site's global nav and footer alone put every page far above the 2-link threshold — this is a near-unconditional PASS running at `defaultPriority: 'high'`, consuming a high-weight report slot while distinguishing nothing. The stated intent (contextual in-content links that build topic clusters) is defensible; nothing in the code measures it, because template chrome and editorial linking are indistinguishable here.

**Required fix:** 1) Count only in-content links: extract against `<main>`/`<article>`, or the document minus `nav`, `header`, `footer`, `aside`, `[role="navigation"]`. 2) Normalize before de-duplication (strip query/hash and trailing slash) so UTM and `?variant=` variants don't inflate the count. 3) Exclude links to the site root and to pagination/filter URLs. 4) Raise the threshold once chrome is excluded — 2 contextual body links is a meaningful bar, 2 total links is not. 5) Drop `defaultPriority` from 'high' to 'medium' until the measurement discriminates. 6) Return `notApplicable` for pages with no extractable body text rather than a high-priority FAIL.

**False-positive risks:**
- `extractInternalLinks(p.$, ctx.domain)` (parser.ts:407) selects `$('a[href]')` across the whole document. Any site with a header nav — i.e. all of them — clears `>= 2` on every page and PASSES 'All N page(s) have 2+ internal cross-links'. The audit cannot fail a real site except an SPA shell or a genuine single-page site.
- The self-link filter only compares `linkUrl.pathname !== pageUrl.pathname`. The site logo linking to `/` counts as a cross-link from every subpage, and `/index.html` vs `/` are treated as different pages.
- `extractInternalLinks` de-dupes by full href, so `/about?utm_source=nav` and `/about` count as two distinct internal links — a UTM-tagged nav inflates the count.
- Pagination, tag and faceted-filter links (`/blog/page/2`, `/?filter=red`) all count as topical cross-links.
- The scan sees only `ctx.pages` (a handful of discovered pages), yet the failure copy calls pages 'orphaned content' — a claim about site-wide link-graph structure that a 5-page sample cannot support.
- SPA/client-rendered sites whose server HTML contains no anchors get a hard FAIL at 'high' priority, though the rendered page is fully cross-linked.
- No `applicablePageTypes`, so product and category pages are graded against a rule the description frames as being about content pages.
- `wellLinkedPages === ctx.pages.length` for the pass means a single link-poor page (a checkout page, or a 404 the crawler discovered) downgrades an otherwise well-linked site to `warn` — an all-or-nothing threshold on a small, arbitrary sample.

**Test gaps:**
- No test with a realistic global nav/footer proving the trivial pass — all four tests use 1-2 hand-placed anchors.
- No test distinguishing nav/footer links from in-content links (the behavior doesn't exist).
- No test for UTM-tagged duplicates of the same destination.
- No test for an SPA shell with no server-rendered anchors.
- No test for pagination/filter links counting as cross-links.
- Only 4 tests — the thinnest suite in the category for an audit weighted 'high'.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Graded evidence (2026-08-21)

**Mechanism claim:** Crawlers discover pages by following `<a href>` links, so a page reachable from no other page on the site is not crawled, and an uncrawled page cannot be shown as a supporting link in AI Overviews or AI Mode.

**Grade: B** — the discovery half of the mechanism is vendor-documented and Google names internal linking as an AI-features fundamental, but the audit's stated mechanism (link structure builds topic clusters and AI-visible site authority) is documented nowhere and has no measured delta.

**Evidence:**
- Google documents link-following as the discovery mechanism and constrains its form: "Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl", "Google can only crawl your link if it's an `<a>` HTML element with an `href` attribute", "Most links in other formats won't be parsed and extracted by Google's crawlers", and "Every page you care about should have a link from at least one other page on your site" — https://developers.google.com/search/docs/crawling-indexing/links-crawlable (verified 2026-08-21)
- Google ties that directly to the AI surfaces: eligibility is gated on indexing — "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — and its list of fundamentals that still apply names internal linking explicitly: "Making your content easily findable through internal links on your website" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** No engine documents deriving "topic clusters" or an authority score from the internal link graph, and the 2026 critical survey rates structural signals as heterogeneous with an unknown sign — "structural fields may improve retrieval without necessarily producing the same effect at the reranking or citation stages", recommending one "test headings, tables, and fields without assuming the direction of effect" (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The documented benefit also accrues to the *linked-to* page, not to the linking page whose outbound count this audit scores, and sitemaps provide an independent discovery path that makes outbound link count non-necessary for indexing. Google's guidance names no threshold; the audit's "≥2 links" bar is unsupported by any source, and counting template chrome makes the measured quantity unrelated to the contextual linking the description argues for.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `machine-discovery/in-content-links` (Plan 4, 2026-08-22) — [merged dossier](../../audits/machine-discovery/in-content-links.md)
