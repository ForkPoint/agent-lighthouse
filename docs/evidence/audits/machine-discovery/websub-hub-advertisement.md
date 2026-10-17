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

Checks whether feeds advertise a push hub per the WebSub Recommendation. More importantly, it checks that the mandatory rel=self link is present, absolute, and equal to the URL the feed was actually fetched from. A wrong self-link breaks hub verification even when a hub is configured.

## Claimed mechanism (falsifiable)

WebSub is a W3C Recommendation requiring publishers to advertise at least one rel=hub and exactly one rel=self via Link headers or embedded link elements, with Link headers taking discovery precedence. Falsifiable claim: a feed that declares a hub, but carries a missing, relative or non-canonical rel=self, cannot complete hub subscription verification. The push path then silently degrades to whatever polling cadence subscribers happen to use. The failure is invisible to the publisher, because the hub appears configured. This check is scored as advisory only: the WebSub conformance assertion is exact and standards-backed, but no AI answer engine is documented as a WebSub subscriber, so the consumer-side benefit is a plausible convention rather than documented behaviour.

## Evidence

- **[WebSub (W3C Recommendation)](https://www.w3.org/TR/websub/)** — W3C (spec, URL verified 2026-08-20)
  - W3C Recommendation. Publishers 'MUST implement at least one' of Link Headers or embedded link elements, advertising at least one rel=hub and exactly one rel=self (the canonical topic URL). Discovery checks Link headers first, then embedded link elements; for HTML, link elements are recommended in <head> only.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id and exactly one atom:updated. The id is a permanent, universally unique IRI that 'must not change across different instantiations of the entry'. The updated time is the 'most recent modification time that the publisher considers significant'. atom:entry MUST also contain atom:summary in two cases: when atom:content carries a src attribute, and is thus empty, and when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[schema.org DataFeed](https://schema.org/DataFeed)** — schema.org (spec, URL verified 2026-08-20)
  - DataFeed = 'a single feed providing structured information about one or more entities or topics'; hierarchy Thing > CreativeWork > Dataset > DataFeed; primary property dataFeedElement accepting DataFeedItem/Text/Thing; DataFeedItem examples use dateCreated, dateModified, item. Adoption is only 1K-10K domains per Google's web index (July 2026 aggregation) — too thin to score against.

## Example failure

A WordPress site with the PubSubHubbub plugin emits `<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>` alongside `<atom:link rel="self" href="/feed/"/>` — a relative href. Every hub subscription attempt fails verification because the topic URL cannot be resolved to the canonical feed, so the site has push infrastructure installed, a plugin reporting success, and zero actual fanout.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Implementation deviations

- **Renamed** from `websub-hub-advertisement-and-self-link-correctness`, which
  exceeds the 64-character id cap. Both halves ship.
- **Nothing here is a failure.** The audit is informative at weight 0, so every
  finding is a `warn`. A test asserts no input produces `fail`.
- **The hub HEAD is a cross-origin request.** The audit reads the status only.
  It never subscribes, POSTs or presents a callback URL. At most two hubs per
  feed are probed.
- **Raw hrefs are kept.** `FeedDocument` in `gatherers/feeds.ts` carries
  `selfLinksRaw` and `hubLinksRaw` as declared, so a relative href can be
  reported.
- **Feed links are read from the direct children of the Atom `feed` or RSS
  `channel` only.** An entry's own `rel="self"` does not count.
- **`atom:link` in RSS is read.** A link counts when it is unprefixed or its
  prefix binds the Atom namespace. `rel` is a token list.
- **HTML page discovery links are not read.** WebSub's examples put them in the
  feed, and an HTML topic would need its own self-link comparison.
- **Only the WebSub Recommendation bears on this audit.** The RFC 4287 and
  schema.org DataFeed sources carry nothing here.
