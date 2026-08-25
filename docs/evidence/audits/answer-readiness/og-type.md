---
audit: answer-readiness/og-type
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/og-type.ts
slug: og-type
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - ogp-me-spec
  - ogp-types
  - meta-sharing-webmasters
  - s18
  - google-ai-features-trust
  - google-special-tags
  - google-article-structured-data
---

# og-type (`4.7`)

> meta-tags · source `og-type.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use og:type to classify page content as either a website, article, product, or other entity type. Without it, agents default to treating the page as generic content, missing opportunities for type-specific handling like article freshness scoring.

## Code review findings (2026-08-20, 11-agent pass)

Presence half is fine; the 'appropriate' half is an English-only URL substring heuristic that is both wrong and, in production, nearly unreachable. `url.includes('/blog')` matches unrelated paths and even matches the `//blog` in a subdomain URL, `/post` matches `/postal-codes`, and because the audit only ever inspects `ctx.pages[0]` (the homepage) the blog branch effectively never fires on real scans — it exists mainly to satisfy a unit test.

**Required fix:** 1) Lowercase before comparing: `if (isBlogPage && ogType !== 'article')` compares a non-normalized value, so a blog page with `content="Article"` (valid, case-insensitive per OGP consumers) is warned. Use `ogType.toLowerCase()`. 2) Replace the substring heuristic `url.includes('/blog') || url.includes('/post') || url.includes('/article')` with the already-computed `page.pageType`, or at minimum with path-segment matching (`/\/(blog|posts?|articles?|news)(\/|$)/`) — the current form matches `/blogging-tools`, `/postal-codes`, `/posters`, and (because `//blog` contains `/blog`) every URL on a `blog.` subdomain. 3) It is English-only: `/noticias`, `/artikel`, `/actualites`, `/nyheter`, `/记事` are never recognized, so non-English blogs are never checked at all — a silent false pass. 4) Iterate real content pages instead of `ctx.pages[0]`; on the homepage `isBlogPage` is false essentially always, making the warn branch dead code in production. 5) Validate the value against the OGP type vocabulary — today any string passes, including `content="blog"` (not an OGP type) and typos.

**False-positive risks:**
- Case sensitivity: `ogType !== 'article'` on a non-lowercased value warns a blog page that correctly declares `content="Article"`.
- Substring path matching: `url.includes('/blog')` fires on `https://example.com/blogging-platform-comparison`; `url.includes('/post')` fires on `/postal-rates` and `/posters`; and `https://blog.example.com/x` contains the substring `/blog` inside `//blog`, so every page on a blog subdomain is treated as a blog post regardless of path.
- English-only: non-English blog paths (`/noticias`, `/artikel`, `/blogg`, `/actualites`) never trigger the check, so genuinely mistyped og:type on those sites gets a clean pass.
- Dead branch in production: `const page = ctx.pages[0]` is the entry/homepage, where `isBlogPage` is virtually always false — the appropriateness check the audit is named for almost never runs on a real scan, so the audit degrades to a presence check while claiming to check appropriateness.
- Any string passes the presence check: `content="blog"`, `content="Website"`, `content="page"`, or a typo like `content="artcile"` all return pass with the value echoed as if validated.
- Redirects: `page.url` is the pre-redirect URL (`fetcher.ts` hardcodes `finalUrl: targetUrl`), so path-based classification can be based on a URL the server no longer serves.
- Product pages with `og:type="product"` and article pages under `/news/` are never cross-checked against `page.pageType`, which the parser already computed — the audit reimplements classification badly instead of reusing it.

**Test gaps:**
- No uppercase `og:type` value test.
- No `/blogging-*` or `/postal-*` false-match test.
- No blog-subdomain test.
- No non-English blog path test.
- No invalid/typo og:type value test.
- No test where pages[0] is the homepage and the blog post is pages[1] — i.e. the production layout, which would reveal the warn branch never fires.

**Overlaps with:** `4.6`, `4.8`, `4.9`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** Open Graph consumers read `og:type` to decide which object vocabulary applies to the page — `article`, `website`, `product`, `video.*` and so on. That choice decides which additional properties they look for and render. A page declaring the wrong type is interpreted as the wrong kind of object.

**Grade: B** — `og:type` is one of the four required properties in the de-facto Open Graph protocol, and adoption is enormous. Meta names it as a tag that changes distribution handling. But the type-selects-behavior effect is documented only in spec terms, and no vendor documents the value-appropriateness effect this audit actually scores.

**Evidence:**
- The Open Graph protocol lists `og:type` among the four required basic properties and ties it to further requirements: "The type of your object, e.g., 'video.movie'. Depending on the type you specify, other properties may also be required." — https://ogp.me/ (verified 2026-08-21)
- The protocol defines the type vocabulary the audit should validate against (`article`, `book`, `profile`, `website`, `music.*`, `video.*`) — https://ogp.me/#types (verified 2026-08-21)
- Meta's webmaster guide lists `og:type` among the tags to add to "improve distribution of your content", alongside the core four read by `facebookexternalhit/1.1` — https://developers.facebook.com/docs/sharing/webmasters/ (verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI agents apply "article freshness scoring" or recency weighting keyed on `og:type="article"` — has no source. OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page describes query fan-out and snippet controls, with no reference to Open Graph — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21); and `og:*` properties are absent from Google's supported-meta-tags list — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Where an engine does consume content typing, the documented vehicle is schema.org structured data (e.g. `Article` with `datePublished`), not `og:type` — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21). The B grade covers presence of a valid OGP type only. The "appropriate" half of this audit is URL-substring blog detection, warning on non-`article` values. No source supports it, and per the review findings above it is effectively dead code in production.
