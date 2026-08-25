---
audit: access-crawl-control/machine-actionable-402-paid-access
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/machine-actionable-402-paid-access.ts
slug: machine-actionable-402-paid-access
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - s5
  - s6
  - s19
  - s12
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

## Competitor coverage

None found in the 2026-08 competitor survey.

## Implementation sketch

Static-fetch, piggybacking on responses already captured by the edge-parity probe. 1) Collect every response with status 402 across the crawler-UA probe matrix and the baseline browser fetch. 2) A 402 is machine-actionable if ANY holds: (a) a `crawler-price` header matching /^[A-Z]{3}\s+\d+(\.\d+)?$/ with an ISO 4217 currency; (b) a `PAYMENT-REQUIRED` header whose base64 decodes to JSON containing `x402Version` and a non-empty `accepts` array, each item having scheme, network, amount, asset and payTo; (c) a `Link: rel=license; type=application/rsl+xml` (or a robots.txt `License:`) resolving to an RSL doc with `<payment type="crawl">` and a valid `<amount currency>` whose `<content url>` covers the 402'd path. 3) Fail when a 402 is returned with `content-type: text/html` and none of the three are present. 4) Secondary assertions worth their own sub-findings: the currency token is real ISO 4217; the amount parses as a decimal; a `Cache-Control` that would let a CDN cache the 402 across clients is flagged (a cached 402 poisons paying crawlers); and a 402 returned to the *browser* baseline as well as to crawler UAs indicates a misapplied rule hitting humans. 5) Emit a distinct informational result — not a failure — when no 402 is observed anywhere, so free sites are not penalised.

## Example failure

A publisher enables a paid-crawl rule at their edge, but the rule is a generic custom response: `HTTP/1.1 402 Payment Required`, `content-type: text/html`, body 'Access to this content requires a licence. Contact sales@example.com.' No `crawler-price`, no `PAYMENT-REQUIRED`, no RSL link. Every crawler willing to pay treats it as an unrecoverable error and removes the URL from its frontier; the publisher earns nothing and loses the citation.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed.** `machine-actionable-402-paid-access-response` would make a
63-character id, inside the cap, but the trailing `-response` says nothing the
rest does not; the audit ships as `machine-actionable-402-paid-access`.

**It issues no request.** The sketch says the audit piggybacks on the
edge-parity probe matrix, and it does: it calls `sharedUaProbes` with the same
URL and token arguments `access-crawl-control/ai-crawler-edge-parity` passes, so
the per-scan cache answers every one. To read the payment headers off those
responses, `UaProbe` gained `baselineHeaders` and `probeHeaders` — the gatherer
kept the bodies but not the headers, and a 402's whole meaning is in its
headers.

**RSL is read inline, not fetched.** `access-crawl-control/rsl-licensing-terms-conformance`
fetches the licence document; fetching it again here would double the cost to
answer a narrower question. This audit reads inline
`<script type="application/rsl+xml">` blocks, and when a licence is advertised
but not readable from what the scan already has, it says exactly that rather
than assuming either way.

**A `Cache-Control` that a shared cache may store is a warning, not a failure.**
The sketch calls it a sub-finding. It is real — a stored 402 is served to a
crawler that already paid — but it is not the defect the audit is named for, and
a site whose 402 is otherwise machine-actionable has done the hard part.

**No 402 is `notApplicable`.** The sketch asks for a distinct informational
result so free sites are not penalised; in this codebase that verdict is
`notApplicable`, which is excluded from the score rather than counted as a pass.

## Deferred

- **Completing a payment.** The audit reads the challenge and never acts on it.
  Paying to verify the flow is a financial transaction a scanner has no standing
  to make.
- **`crawler-max-price` negotiation.** Cloudflare's flow has the crawler retry
  with `crawler-exact-price`. A scanner that retried would be starting a
  purchase.
- **402s outside the probe matrix.** Only URLs the edge-parity probes visit are
  seen. A paywalled section neither the sitemap nor the homepage links to is not
  sampled.
