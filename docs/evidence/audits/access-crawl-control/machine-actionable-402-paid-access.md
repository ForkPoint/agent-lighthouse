---
audit: access-crawl-control/machine-actionable-402-paid-access
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/machine-actionable-402-paid-access.ts
slug: machine-actionable-402-paid-access
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-10-19
graduated: 2026-08-23
sources:
  - duckduckgo-duckassistbot
  - meta-crawlers
  - amazonbot-docs
  - mistral-robots-docs
  - s5
  - s6
  - s19
  - s12
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-doc
  - chromium-dash-stable
---

# Machine-actionable 402 paid-access response

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

When a site charges for crawler access, this verifies the 402 response carries a price a machine can read and act on, in one of the three deployed formats. A 402 with a human HTML error page is functionally a hard block: the crawler cannot compute an offer, so it drops the URL rather than paying.

## Claimed mechanism (falsifiable)

Every deployed paid-crawl scheme puts the price in a machine-readable slot, never in the body prose. Cloudflare pay-per-crawl returns 402 with `crawler-price: USD XX.XX`. The crawler then retries with `crawler-exact-price`, or pre-declares `crawler-max-price`, and receives 200 plus `crawler-charged` on success (s5). x402 v2 works differently. It puts a base64-encoded PaymentRequired payload in the `PAYMENT-REQUIRED` response header, carrying `x402Version: 2` and an `accepts[]` array of {scheme, network, amount, asset, payTo, maxTimeoutSeconds, extra} (s19). RSL expresses it declaratively as `<payment type="crawl"><amount currency="USD">0.015</amount></payment>` (s12). Falsifiable: a 402 carrying none of these three signals contains no price any client can parse, so no retry is constructible.

## Evidence

- **[Introducing pay per crawl: Enabling content owners to charge AI crawlers](https://blog.cloudflare.com/introducing-pay-per-crawl/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Exact wire format for paid crawling. Server returns HTTP 402 Payment Required with `crawler-price: USD XX.XX`. Crawler retries with `crawler-exact-price: USD XX.XX`, or pre-declares with `crawler-max-price: USD XX.XX`. Successful paid fetch returns 200 with `crawler-charged: USD XX.XX`.
- **[Pay per crawl — AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Feature landing page confirming pay-per-crawl ships as a product surface under AI Crawl Control (private beta). Technical detail lives in the blog post (s5); this is the canonical product doc URL to cite in remediation text.
- **[x402 Specification v2](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)** — x402 Foundation (spec, URL verified 2026-08-20)
  - PaymentRequired payload carries `"x402Version": 2` and an `accepts` array whose items have `scheme`, `network`, `amount`, `asset`, `payTo`, `maxTimeoutSeconds`, `extra`. "For HTTP, the canonical wire location is the base64-encoded `PAYMENT-REQUIRED` response header"; a `PAYMENT-SIGNATURE` header appears in examples. Protocol is transport-agnostic; HTTP binding lives in specs/transports-v2/http.md. Note the older repo path coinbase/x402 and specs/x402-specification.md are now 404.
- **[RSL 1.0 Standard Specification](https://rslstandard.org/rsl)** — RSL Collective (spec, URL verified 2026-08-20)
  - robots.txt directive `License: https://example.com/license.xml` — "The value MUST be an absolute URI"; may be global or inside a User-agent group; multiple allowed. HTTP discovery: `Link: <https://example.com/license.xml>; rel="license"; type="application/rsl+xml"`. HTML: `<link rel="license" type="application/rsl+xml" href="...">` or inline `<script type="application/rsl+xml">`. no default/well-known location is mandated. XML: root `<rsl xmlns="https://rslstandard.org/rsl" max-age>`, `<content url required, server, encrypted>`, `<license>`, `<permits|prohibits type="usage|user|geo">`, `<payment type="purchase|subscription|crawl|use|attribution|free">`, `<amount currency=ISO4217>`, `<standard>`, `<copyright type contactEmail contactUrl>`, `<legal type="warranty|disclaimer|attestation|contact|proof">`.

## Example failure

A publisher enables a paid-crawl rule at their edge, but the rule is a generic custom response: `HTTP/1.1 402 Payment Required`, `content-type: text/html`, body 'Access to this content requires a licence. Contact sales@example.com.' No `crawler-price`, no `PAYMENT-REQUIRED`, no RSL link. Every crawler willing to pay treats it as an unrecoverable error and removes the URL from its frontier; the publisher earns nothing and loses the citation.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The audit issues no request. It calls `sharedUaProbes` with the same arguments as `access-crawl-control/ai-crawler-edge-parity`, so the per-scan cache answers every probe. It reads the payment headers from `UaProbe.baselineHeaders` and `probeHeaders`.
- The probe URLs come from the shared sitemap gatherer. On a subpath homepage it keeps only same-origin URLs under that directory.
- RSL is read from inline `<script type="application/rsl+xml">` blocks, not fetched. `access-crawl-control/rsl-licensing-terms-conformance` fetches the licence document. An advertised but unread licence is reported as such.
- A `Cache-Control` that lets a shared cache store the 402 is a warning, not a failure.
- No 402 anywhere is not applicable, so free sites are not penalised.
- OAI-SearchBot is sent as `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`, the example OpenAI gives (https://developers.openai.com/api/docs/bots, verified 2026-10-19). Before 2026-10-19 the probe sent a bare `OAI-SearchBot/1.0` string that OpenAI does not document. GPTBot and ChatGPT-User match the same page.
- PerplexityBot is sent as the full string Perplexity documents (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19).
- The ClaudeBot and Claude-User strings are observed, not vendor-documented. Anthropic's crawler page names both tokens but publishes no User-Agent string (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-19). A finding for either reports how the site answers a request that carries that observed string.
- Since 2026-10-19 the probe set is read from the bot registry (`packages/core/src/bot-registry.ts`): every documented row with a literal User-Agent string. That added two user-triggered fetchers. Perplexity-User is sent as `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)`; Perplexity says it "supports user actions within Perplexity" (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-10-19). MistralAI-User is sent as `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)`, which Mistral labels the full user-agent string of the fetcher that answers a user's question in Vibe (https://docs.mistral.ai/robots, verified 2026-10-19). Both strings are copied verbatim. A block of either now counts the same way a ChatGPT-User block already did. Each costs one request per probed URL.
- The other documented user-triggered fetchers are not probed, because no literal string exists. Amazon's Amzn-User string carries a `Chrome/W.X.Y.Z` placeholder (https://developer.amazon.com/amazonbot, verified 2026-10-19). Meta says its log entries "will be similar to" `meta-externalfetcher/1.1 (+/documentation/sharing/webmasters/web-crawlers)` (https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/, verified 2026-10-19). Filling in either would invent a string. DuckAssistBot is not probed: DuckDuckGo does not say its fetches are user-triggered.
- The browser baseline is a Mac Chrome UA on the current Stable major, 155 (https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1, verified 2026-10-19). It was Chrome 140 before 2026-10-19.

## Deferred

- **Completing a payment.** The audit reads the challenge and never acts on it.
  A scanner has no standing to make a financial transaction.
- **`crawler-max-price` negotiation.** A scanner that retried with
  `crawler-exact-price` would be starting a purchase.
- **402s outside the probe matrix.** Only URLs the edge-parity probes visit are
  seen. A paywalled section neither the sitemap nor the homepage links to is not
  sampled.
