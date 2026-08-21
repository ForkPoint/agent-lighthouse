---
audit: answer-readiness/og-site-name
audit_id: "4.8"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/og-site-name.ts
slug: og-site-name
review_verdict: merge
severity: low
evidence_grade: A
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# og-site-name (`4.8`)

> meta-tags · source `og-site-name.ts` · review verdict **merge** · evidence grade **A** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI agents use og:site_name to associate individual pages with your brand entity. Without it, agents may not connect pages from your site as belonging to the same organization, fragmenting your brand identity across AI-generated responses.

## Code review findings (2026-08-20, 11-agent pass)

A 26-line presence check for one more Open Graph tag, structurally identical to the loop already running in core-open-graph (4.6). It measures the same underlying signal — 'does this page emit its OG tags' — and there is no reason for it to be a separately weighted audit. The claim that omitting it 'fragments your brand identity across AI-generated responses' is unsupported: no AI answer engine is documented to build entity association from og:site_name.

**Required fix:** Fold og:site_name into CoreOpenGraphAudit (4.6) as a recommended-but-not-core tag: extend the OG_CORE loop with a second RECOMMENDED list that downgrades a miss to a warn rather than a standalone fail. If kept standalone, at minimum stop asserting brand-entity effects that no consumer exhibits, iterate all `ctx.pages` instead of `ctx.pages[0]`, and reject placeholder values ('Site Name', the raw domain, template tokens) which currently pass via `if (siteName)`.

**False-positive risks:**
- Placeholder values pass: `const siteName = (page?.meta?.['og:site_name'] ?? '').trim(); if (siteName)` accepts `content="Your Site Name"` (verbatim from the audit's own code sample), `content="{{ site.title }}"`, or `content="WordPress Site"`.
- Only `ctx.pages[0]` is examined despite `guidance.fix` saying 'Add og:site_name to every page'; the audit cannot observe the inconsistency it warns about.
- Sites that express brand identity through JSON-LD Organization/WebSite (the form agents parse) but omit this legacy OG tag get a 'medium' priority failure and are told their brand identity is fragmenting — wrong guidance.
- WAF interstitial / JS-injected head → false fail alongside the rest of the category.
- Double-counting with 4.6: a site with no OG tags at all is failed by core-open-graph AND by this audit AND (via the no-og:image path) by og-image-alt, so one root cause costs three separate scores.

**Test gaps:**
- No placeholder-value test.
- No multi-page test.
- No test asserting non-overlap with core-open-graph.
- Only 3 tests, all single-page — the file is a near-verbatim copy of og-type.test.ts minus the warn case.

**Overlaps with:** `4.6`

## Evidence

### Signal: Open Graph og:title and og:site_name — grade A (meta-head)

**Mechanism:** og:title and og:site_name in the head are read by Google and used as candidate sources for the title link and the site name shown on a result — labels that carry through to AI Overviews / AI Mode source cards. Falsifiable: if Google's title-link and site-name documentation did not name these properties, the claim fails.

**Evidence:** This is the one Open Graph claim with direct vendor documentation. Google's title-link page lists "Content in og:title meta tags" among the sources it uses to generate a title link. Google's site-names page states the site name system "will also consider content in og:site_name, <title>, heading elements, and other text on a home page." Both outputs label the page wherever Google surfaces it, including AI Overviews and AI Mode source attributions. The OGP spec itself is a stable, widely implemented convention under the Open Web Foundation Agreement 0.9.

**Counter-evidence:** Google ranks these below other sources — WebSite structured data is "most important" for site name, and <title> plus the visual title outrank og:title for title links; so og:* is a tiebreaker, not a lever. No AI-native vendor (OpenAI, Anthropic, Perplexity, Apple) documents reading any Open Graph property. The OGP spec is not a W3C/IETF standard and has had no substantive revision in years. Score presence and title/og:title consistency; do not claim a ranking or citation-rate effect.
**Consumers:** Googlebot (title link + site name systems), Facebook/Meta, LinkedIn, Slack, Discord and other unfurlers (per OGP spec), none-known for OAI-SearchBot, ClaudeBot, PerplexityBot, Applebot · **Recommended tier:** scored

**Sources:** [Control your title links in search results](https://developers.google.com/search/docs/appearance/title-link) · [Site names in Google Search](https://developers.google.com/search/docs/appearance/site-names) · [The Open Graph protocol](https://ogp.me/) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
