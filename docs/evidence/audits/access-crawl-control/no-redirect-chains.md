---
audit: access-crawl-control/no-redirect-chains
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-redirect-chains.ts
slug: no-redirect-chains
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-http-status-codes
  - google-crawl-budget-docs
  - google-ai-features-trust
  - s18
  - perplexity-crawlers-docs
---

# no-redirect-chains (`1.16`)

> content-discoverability · source `no-redirect-chains.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Redirect chains waste AI crawler budget and slow down content discovery. Each page should resolve in a single redirect at most.

## Code review findings (2026-08-20, 11-agent pass)

BROKEN — always passes. It compares `page.fetchResult.url` with `page.fetchResult.finalUrl`, but fetcher.ts sets `finalUrl: targetUrl` unconditionally (its own comment: 'undici doesn't expose final URL after redirects easily'). The two values are equal by construction on every real scan, so the audit reports 'All N page(s) resolve without redirects' even for a site where every single URL 301s. The tests hide this by hand-assigning finalUrl to a value production can never produce.

**Required fix:** Make the fetcher record the redirect chain: either drop the redirect interceptor for this purpose and follow hops manually (`followRedirects: false`, loop on Location, cap at 5), or capture undici's redirect history and expose `redirectChain: string[]` plus a real `finalUrl` on FetchResult. Then fail on chains of length >= 2, warn on a single hop, and ignore pure http→https / trailing-slash normalizations. Rewrite the tests to drive the real fetcher against a stub server instead of assigning finalUrl by hand.

**False-positive risks:**
- `if (requestUrl !== finalUrl)` can never be true in production: `fetcher.ts` returns `finalUrl: targetUrl` in both the success and error paths. Guaranteed false PASS on 100% of scans.
- Even if finalUrl were populated, comparing start vs end URL detects *a* redirect, never a *chain* — the audit's stated subject (multi-hop) is unmeasurable this way. The undici redirect interceptor is configured with maxRedirections: 5 and the hop count is discarded.
- Cosmetic normalizations (http→https, adding a trailing slash, bare→www) would be reported as defects identically to genuine legacy chains, once finalUrl worked.
- `redirected.length > ctx.pages.length / 2` on a one-page scan means a single redirect is a site-wide FAIL.
- The tests set `p.fetchResult.finalUrl` manually, so the suite is green while the audit is inert — the coverage gives false confidence.

**Test gaps:**
- Any test exercising the real fetcher — the entire suite fakes finalUrl, concealing that the audit cannot fail
- Multi-hop chain (the audit's stated subject) vs a single hop
- http→https and trailing-slash normalization (should not be a defect)
- Cross-host redirect (bare → www)
- Redirect loop / exceeding maxRedirections

**Overlaps with:** `1.20`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** A URL reachable only through more redirect hops than the crawler's limit is never fetched; Googlebot's limit is 10 hops. Long chains also consume crawl capacity that would otherwise be spent on real content. The page is therefore not indexed — and since indexing is a precondition for Google's AI surfaces, it cannot be cited there.

**Grade: A** — Google publishes the exact hop limit its named crawlers apply and states directly that long chains harm crawling.

**Evidence:**
- "By default, Google's crawlers follow up to 10 redirect hops. However, specific products' crawlers may have different limits." — an explicit, falsifiable behaviour of a named agent on this exact signal — https://developers.google.com/search/docs/crawling-indexing/http-network-errors (verified 2026-08-21)
- Same page: "Any content Google receives from the redirecting URL is ignored, and the final target URL's content is processed instead", so every intermediate hop is a wasted fetch — https://developers.google.com/search/docs/crawling-indexing/http-network-errors (verified 2026-08-21)
- Google's crawl-budget guidance states the effect outright: "Avoid long redirect chains, which have a negative effect on crawling." — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget (verified 2026-08-21)
- The consequence for AI surfaces is documented: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — an unfetchable URL is not indexed — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** The documented harm attaches to *long* chains and to exceeding the hop limit; no vendor documents any penalty for a single redirect, and Google states the target's content is simply "processed instead", which makes routine http→https, bare→www and trailing-slash normalisations non-defects. The audit as implemented flags any request URL that differs from its final URL — a threshold with no support in any source cited here, and one that is inert in production because `finalUrl` is assigned `targetUrl` unconditionally. No AI-specific vendor publishes a hop limit for its own fetchers: OpenAI's crawler documentation (https://developers.openai.com/api/docs/bots) and Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) cover robots.txt only and say nothing about redirects (both verified 2026-08-21), so the proven consumer path here is Googlebot's, inherited by Google's AI features. Google's own redirect guidance page does not discuss chain length or PageRank loss at all (https://developers.google.com/search/docs/crawling-indexing/301-redirects, verified 2026-08-21) — the "chains dilute link equity" claim common in SEO blogs has no primary source and is not relied on here.
