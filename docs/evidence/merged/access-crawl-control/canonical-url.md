---
audit: access-crawl-control/canonical-url
audit_id: "4.3"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/canonical-url.ts
slug: canonical-url
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# canonical-url (`4.3`)

> meta-tags · source `canonical-url.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI crawlers use canonical URLs to deduplicate content and determine the authoritative version of a page. Without a canonical tag, agents may index multiple URL variants of the same content, diluting your page authority in AI knowledge bases.

## Code review findings (2026-08-20, 11-agent pass)

Right signal, dangerously shallow check. It verifies only that some `<link rel="canonical">` exists with an href starting with the literal string 'http' — it never checks that the canonical actually points at the page being audited. The most common and most damaging real-world canonical bug (every page canonicalizing to the homepage, or to a staging/other domain) scores a clean 1.0 pass with a 'high' priority green check. That is actively wrong guidance, not merely incomplete.

**Required fix:** 1) Compare the canonical against the page: resolve `href` against `page.url` and warn when the canonical points to a different origin, or when many scanned pages share one canonical target (the classic 'all pages canonical to /' misconfiguration). Today `if (href.startsWith('http')) return this.pass(...)` accepts anything. 2) `href.startsWith('http')` also accepts `href="httpfoo"` — use `new URL(href)` and check the protocol is http/https. 3) `l.rel === 'canonical'` is exact and case-sensitive: accept `rel="Canonical"`, `rel=" canonical "`, and multi-token rel by lowercasing and splitting on whitespace. 4) Read the `Link: <...>; rel="canonical"` HTTP response header from `page.fetchResult.headers` before failing — Shopify, many CDNs and all non-HTML resources canonicalize via header only. 5) Iterate all `ctx.pages`, not just `ctx.pages[0]`. 6) Flag multiple conflicting `rel=canonical` links on one page (currently `.find` silently takes the first).

**False-positive risks:**

- Green pass on a broken canonical: `if (href.startsWith('http')) return this.pass(...)` — a site where every page emits `<link rel="canonical" href="https://example.com/">` (a very common CMS/plugin misconfiguration that deindexes the whole site) is reported as correctly canonicalized.
- Green pass on a cross-domain or staging canonical (`https://staging.example.com/page`) — never compared against `page.url`.
- `href.startsWith('http')` is a string prefix test, not a URL parse: `href="httpsss://x"` or `href="http"` passes.
- Case-sensitive exact match `l.rel === 'canonical'` fails on `rel="Canonical"` (emitted by some legacy CMSes) and on any multi-token rel value, reporting 'No canonical URL found' with priority 'high' on a page that has one.
- HTTP `Link: <https://…>; rel="canonical"` header is never read — sites that canonicalize by header only get a hard fail.
- Only `ctx.pages[0]` is checked: homepage has a canonical, the 20 templated product pages do not → pass.
- `extractHeadLinks` scans the whole document, so a `rel=canonical` inside body content or a `<template>` counts as if it were in `<head>` — where crawlers would ignore it.
- Redirects: `fetcher.ts` hardcodes `finalUrl: targetUrl`, so a page reached through a redirect is compared (in any future fix) against the wrong URL; today the audit just doesn't compare at all.
- SPA shells that inject the canonical client-side have no canonical in the fetched HTML → fail, even though the rendering crawlers that matter here would see one.

**Test gaps:**

- No test where the canonical points to a different page or a different domain — the highest-impact real-world failure mode is entirely untested.
- No uppercase/whitespace/multi-token `rel` test.
- No `Link:` HTTP header canonical test.
- No multiple-canonical-tags-on-one-page test.
- No multi-page test.
- No `href="httpfoo"` malformed-scheme test that would expose the `startsWith('http')` weakness.

**Overlaps with:** `4.5`

## Evidence

### Signal: canonical URL (rel="canonical") — grade B (meta-head)

**Mechanism:** rel="canonical" in the head consolidates duplicate/parameterized URLs onto one address, so the canonical URL is the one held in the search index and therefore the URL that index-derived AI surfaces cite and link. Falsifiable: if AI answer engines cited whichever variant URL they happened to fetch regardless of canonical, or if vendors documented ignoring it, the claim fails.

**Evidence:** Unlike most head signals, rel=canonical has ratified-standard footing: RFC 6596 registers the canonical link relation on the IETF standards track for both the HTML <link> element and the HTTP Link header. Google documents it as "a strong signal that the specified URL should become canonical" and as the way "to specify which URL that you want people to see in search results," and Google's AI-features doc makes indexed-and-snippet-eligible status the gate for AI Overviews/AI Mode — so the canonical decision propagates into which URL an AI answer links.

**Counter-evidence:** Google calls it a signal, not a directive, and reserves the right to pick a different canonical. Critically, none of OpenAI's, Anthropic's, or Perplexity's crawler documentation mentions canonical URLs, canonicalization, or duplicate handling — the mechanism for non-Google AI engines is entirely unevidenced. Agency blog claims that AI engines "prefer faster-loading variants over the canonical" are speculation with no published data. Grade B rests on the Google/Bing chain plus the RFC; it would be A only if an AI-specific vendor statement existed.
**Consumers:** Googlebot (documented consolidation; AI Overviews/AI Mode inherit the indexed URL), Bingbot / Copilot grounding, none-known for OAI-SearchBot, ClaudeBot/Claude-SearchBot, PerplexityBot · **Recommended tier:** scored

**Sources:** [RFC 6596 — The Canonical Link Relation](https://www.rfc-editor.org/rfc/rfc6596.html) · [How to specify a canonical URL with rel="canonical" and other methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

### Signal: Canonical URL consolidation (rel=canonical consistent with sitemap, internal links and redirects) — grade B (discovery-infra)

**Mechanism:** Declaring a single self-consistent canonical URL causes retrieval and answer systems to consolidate duplicate variants into one indexed, citable identifier, so citations and ranking signals concentrate on one URL rather than splitting across parameterized, protocol or trailing-slash duplicates. Falsifiable: if AI answer engines cite duplicate variants at the same rate regardless of canonical declaration, the claim fails.

**Evidence:** The mechanism is documented end-to-end on the Google side. Google states canonicalization exists 'To specify which URL that you want people to see in search results' and 'To consolidate signals for similar or duplicate pages', ranks rel=canonical as 'a strong signal that the specified URL should become canonical' (with redirects equally strong and sitemap inclusion 'a weak signal'), and warns that duplicates mean 'search engines might waste crawling resources on URLs'. Because Google's own AI documentation requires that 'a page must be indexed and eligible to be shown in Google Search with a snippet' to appear in AI Overviews or AI Mode, whichever variant wins canonicalization is by construction the variant eligible for AI citation. RFC 6596 formalizes the link relation and names search engines as the consumer class that will 'index only the canonical version' and 'consolidate link popularity metrics'. Crawl-economics data reinforces the waste argument: Cloudflare's crawl-to-refer measurements show AI crawlers fetch orders of magnitude more HTML than they refer back, so duplicate URL surfaces multiply an already lopsided crawl load.

**Counter-evidence:** No AI vendor documents canonical handling directly. Google's AI-features page never mentions rel=canonical as a prerequisite, and Google explicitly deflates the stakes: 'your site will likely do just fine without specifying a canonical preference' — Google will pick a canonical itself, and may pick one other than the declared URL. RFC 6596 is Informational, not Standards Track, so it is a documented convention rather than a ratified requirement. OpenAI, Anthropic and Perplexity are all silent on canonical URLs. Every published claim that 'AI retrieval pipelines use canonicals to deduplicate their source lists' traces to SEO-vendor blogs, not to primary documentation or measurement; that framing should not be reproduced as evidence.
**Consumers:** Googlebot → AI Overviews / AI Mode / Gemini grounding, Bingbot → Copilot, (RFC 6596 names Google, Yahoo and Bing as implementers) · **Recommended tier:** scored

**Sources:** [How to Specify a Canonical URL with rel="canonical" and Other Methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [RFC 6596 — The Canonical Link Relation](https://www.rfc-editor.org/rfc/rfc6596.html) · [Google's Guide to Optimizing for Generative AI Features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [The crawl before the fall… of referrals: understanding AI's impact on content providers](https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar/) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `access-crawl-control/canonical` (Plan 4, 2026-08-22) — [merged dossier](../../audits/access-crawl-control/canonical.md)
