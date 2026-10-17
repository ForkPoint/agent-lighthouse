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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the request/final URL of each scanned page,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  The redirect is counted **before** the guard runs: a hop that left the site
  is this audit's subject, and leaving the site is exactly what denies
  `origin-reachable`. A scan redirected to a parking host now fails naming the
  hop instead of declining. The guard only stops the audit _clearing_ a site
  whose pages it never saw. The gate exemption drops `origin-reachable` for
  the same reason; the page-fed keys stay, because with no page there is no
  hop.
  Verdicts that moved on the five nothing-obtained contract states: walled
  fail → na, throttled fail → na, non-HTML homepage pass → na, HTTP 200 bot
  challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — `requires` is now empty. The gate exemption already dropped
  `origin-reachable`, because a hop that left the site is this audit's subject;
  `rendered-body` and `sample-adequate` now go with it. A hop is recorded by the
  response — request URL against final URL — and a page that renders no text
  resolves in as many hops as any other. The audit reports "no pages scanned"
  itself, so nothing relies on those keys standing in for a page existing. The
  verdict itself does not move, but the gate is on for every scan, so a
  client-rendered scan is now scored on its redirect behaviour at weight 1.0
  instead of being skipped. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Evidence (2026-08-21)

**Mechanism claim:** A URL reachable only through more redirect hops than the crawler's limit is never fetched; Googlebot's limit is 10 hops. Long chains also consume crawl capacity that would otherwise be spent on real content. The page is therefore not indexed — and since indexing is a precondition for Google's AI surfaces, it cannot be cited there.

**Grade: A** — Google publishes the exact hop limit its named crawlers apply and states directly that long chains harm crawling.

**Evidence:**

- "By default, Google's crawlers follow up to 10 redirect hops. However, specific products' crawlers may have different limits." — an explicit, falsifiable behaviour of a named agent on this exact signal — https://developers.google.com/search/docs/crawling-indexing/http-network-errors (verified 2026-08-21)
- Same page: "Any content Google receives from the redirecting URL is ignored, and the final target URL's content is processed instead", so every intermediate hop is a wasted fetch — https://developers.google.com/search/docs/crawling-indexing/http-network-errors (verified 2026-08-21)
- Google's crawl-budget guidance states the effect outright: "Avoid long redirect chains, which have a negative effect on crawling." — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget (verified 2026-08-21)
- The consequence for AI surfaces is documented: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet." An unfetchable URL is not indexed — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** The documented harm attaches to _long_ chains, and to exceeding the hop limit. No vendor documents any penalty for a single redirect, and Google states the target's content is simply "processed instead". That makes routine http-to-https, bare→www and trailing-slash normalisations non-defects. The audit as implemented flags any request URL that differs from its final URL — a threshold with no support in any source cited here, and one that is inert in production because `finalUrl` is assigned `targetUrl` unconditionally. No AI-specific vendor publishes a hop limit for its own fetchers. OpenAI's crawler documentation (https://developers.openai.com/api/docs/bots) and Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) cover robots.txt only, and say nothing about redirects (both verified 2026-08-21), so the proven consumer path here is Googlebot's, inherited by Google's AI features. Google's own redirect guidance page does not discuss chain length or PageRank loss at all (https://developers.google.com/search/docs/crawling-indexing/301-redirects, verified 2026-08-21) — the "chains dilute link equity" claim common in SEO blogs has no primary source and is not relied on here.
