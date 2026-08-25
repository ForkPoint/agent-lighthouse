---
audit: machine-discovery/websub-hub-advertisement
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/websub-hub-advertisement.ts
slug: websub-hub-advertisement
evidence_grade: C
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - websub
  - rfc4287
  - schema-datafeed
---


# WebSub hub advertisement and self-link correctness

> Shipped in v2. Evidence grade **C** · informative tier · unique · implementation: `static-fetch`

## What it checks

Checks whether feeds advertise a push hub per the WebSub Recommendation, and — more importantly — whether the mandatory rel=self link is present, absolute, and equal to the URL the feed was actually fetched from, since a wrong self-link breaks hub verification even when a hub is configured.

## Claimed mechanism (falsifiable)

WebSub is a W3C Recommendation requiring publishers to advertise at least one rel=hub and exactly one rel=self via Link headers or embedded link elements, with Link headers taking discovery precedence. Falsifiable claim: a feed declaring a hub but carrying a missing, relative, or non-canonical rel=self cannot complete hub subscription verification, so the push path silently degrades to whatever polling cadence subscribers happen to use — the failure is invisible to the publisher because the hub appears configured. This check is scored as advisory only: the WebSub conformance assertion is exact and standards-backed, but no AI answer engine is documented as a WebSub subscriber, so the consumer-side benefit is a plausible convention rather than documented behaviour.

## Evidence

- **[WebSub (W3C Recommendation)](https://www.w3.org/TR/websub/)** — W3C (spec, URL verified 2026-08-20)
  - W3C Recommendation. Publishers 'MUST implement at least one' of Link Headers or embedded link elements, advertising at least one rel=hub and exactly one rel=self (the canonical topic URL). Discovery checks Link headers first, then embedded link elements; for HTML, link elements are recommended in <head> only.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id and exactly one atom:updated. The id is a permanent, universally unique IRI that 'must not change across different instantiations of the entry'. The updated time is the 'most recent modification time that the publisher considers significant'. atom:entry MUST also contain atom:summary in two cases: when atom:content carries a src attribute, and is thus empty, and when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[schema.org DataFeed](https://schema.org/DataFeed)** — schema.org (spec, URL verified 2026-08-20)
  - DataFeed = 'a single feed providing structured information about one or more entities or topics'; hierarchy Thing > CreativeWork > Dataset > DataFeed; primary property dataFeedElement accepting DataFeedItem/Text/Thing; DataFeedItem examples use dateCreated, dateModified, item. Adoption is only 1K-10K domains per Google's web index (July 2026 aggregation) — too thin to score against.

## Competitor coverage

The W3C Feed Validator flags a missing atom:link rel=self but does not compare it to the fetch URL, does not check Link headers, and does not liveness-probe the hub. No SEO or AI-visibility product covers WebSub at all.

## Implementation sketch

For each discovered feed: (1) inspect HTTP Link response headers first (per the spec's precedence order) for rel=hub and rel=self; (2) fall back to <link rel="hub"> / <atom:link rel="self"> elements inside the feed document, and for HTML pages accept them only within <head>. (3) Assert exactly one rel=self and that its href is absolute and, after normalization, equal to the URL the feed was fetched from (FAIL on relative hrefs, http-vs-https mismatch, or a self-link pointing at a different path). (4) Assert at least one rel=hub with an absolute HTTPS href; HEAD the hub URL and accept 2xx/400/405 as alive, FAIL on DNS failure, connection refused, or 5xx. (5) When no hub is declared, emit INFO with a remediation pointing at hosted hubs, never a FAIL. Report as an advisory badge outside the scored total until an AI-side subscriber is documented.

## Example failure

A WordPress site with the PubSubHubbub plugin emits `<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>` alongside `<atom:link rel="self" href="/feed/"/>` — a relative href. Every hub subscription attempt fails verification because the topic URL cannot be resolved to the canonical feed, so the site has push infrastructure installed, a plugin reporting success, and zero actual fanout.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `websub-hub-advertisement-and-self-link-correctness`, which
would make a 68-character id. Both halves ship.

All five steps of the sketch ship: `Link:` headers read before the document,
the exactly-one absolute `rel=self` assertion with normalized comparison
against the URL the feed was fetched from, the HTTPS `rel=hub` assertion, the
HEAD probe accepting 2xx/400/405, and the never-a-failure rule for a feed that
declares no hub.

**Nothing here is a failure.** The sketch reserves FAIL for the conformance
arms, but the audit ships `tier: 'informative'` with `weight: 0`, so a `fail`
would render as a red finding that cannot move the score — which reads as a
bug. Every finding is a `warn`, and a test asserts no input produces `fail`.
When an AI-side WebSub subscriber is documented, the tier moves and the arms
can be reclassified in one place.

**The hub HEAD is the one cross-origin request in this wave.** A hub is by
definition somebody else's host. The audit sends a HEAD and reads the status;
it never subscribes, never POSTs, and never presents a callback URL.

**Discovery-link parsing lives in `gatherers/feeds.ts`.** `FeedDocument` gained
`selfLinksRaw` and `hubLinksRaw` — the hrefs exactly as declared — because the
resolved forms cannot tell a relative href from an absolute one, which is one
of the defects this audit reports.

**Evidence hygiene.** Only the first source, the WebSub Recommendation, bears
on this audit. The RFC 4287 entry belongs to
`machine-discovery/feed-entry-identity-and-canonical-integrity` and the
schema.org DataFeed entry to neither; nothing here rests on them.

## Deferred

- **Completing a subscription.** Verification needs a callback URL the scanner
  would have to host and a hub POST. The audit measures the advertisement, not
  the round trip.
- **HTML page discovery links.** The sketch accepts `<link rel="hub">` in an
  HTML `<head>`; this audit reads feeds, where WebSub's own examples put them.
  An HTML topic URL is a different topic from the feed and would need its own
  self-link comparison.
- **More than two hubs per feed.** Each is a cross-origin request. A feed with
  three hubs has the same advertisement defect as one with two.
