---
audit: machine-discovery/websub-hub-advertisement
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/websub-hub-advertisement.ts
slug: websub-hub-advertisement
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23; re-graded C/informative to B/scored 2026-10-18"
reviewed: 2026-10-18
graduated: 2026-08-23
sources:
  - websub
  - rfc4287
  - schema-datafeed
  - google-build-sitemap
---

# WebSub hub advertisement and self-link correctness

> Shipped in v2. Evidence grade **B** · scored tier (weight 0.6) · unique · implementation: `static-fetch`

## What it checks

Checks the WebSub links on each feed that advertises a push hub. The feed should carry exactly one absolute rel=self link, and each hub should be an absolute URL whose server answers a HEAD. WebSub does not require HTTPS for the hub, so an `http://` hub is accepted. A hub that refuses the scanner with 401, 403 or 429, as a WAF or bot challenge does, still counts as present. A missing, duplicated or relative self link breaks hub verification even when a hub is configured.

The self URL may differ from the URL the feed was fetched from. The Recommendation allows it, so the audit does not compare them.

| State                                                                                  | Result |
| :------------------------------------------------------------------------------------- | :----- |
| no feed                                                                                | `na`   |
| feeds, but none advertises a hub                                                       | `na`   |
| every hubbed feed has one absolute self link and a live hub                            | `pass` |
| a hubbed feed has a missing, duplicated or relative self link                          | `warn` |
| a hub URL is relative, fails the address check, does not answer, or answers 404 or 5xx | `warn` |

## Claimed mechanism (falsifiable)

WebSub is a W3C Recommendation. Publishers MUST implement at least one discovery mechanism: Link headers or embedded link elements. They SHOULD advertise at least one rel=hub and exactly one rel=self, and Link headers take discovery precedence. Falsifiable claim: a feed that declares a hub, but carries a missing, duplicated or relative rel=self, cannot complete hub subscription verification. The push path then silently degrades to whatever polling cadence subscribers happen to use. The failure is invisible to the publisher, because the hub appears configured. Google Search documents receiving WebSub notifications. No LLM vendor documents subscribing.

## Evidence

- **[WebSub (W3C Recommendation)](https://www.w3.org/TR/websub/)** — W3C (spec, URL verified 2026-08-20)
  - W3C Recommendation. Publishers 'MUST implement at least one' of Link Headers or embedded link elements. The publisher 'SHOULD include at least one Link Header … with rel=hub … as well as exactly one Link Header … with rel=self'. Discovery checks Link headers first, then embedded link elements; for HTML, link elements are recommended in <head> only. `hub.topic` 'MUST be the "self" URL found during the discovery step, which may be different from the URL that was used to make the discovery request' (verified 2026-10-18).
- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google (vendor doc, URL verified 2026-10-18)
  - 'If you use Atom or RSS, you can use WebSub to broadcast your changes to search engines, including Google.' The wording is optional, so a feed without a hub costs the site nothing. Google Search is the consumer; no LLM vendor documents subscribing to a hub.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id and exactly one atom:updated. The id is a permanent, universally unique IRI that 'must not change across different instantiations of the entry'. The updated time is the 'most recent modification time that the publisher considers significant'. atom:entry MUST also contain atom:summary in two cases: when atom:content carries a src attribute, and is thus empty, and when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[schema.org DataFeed](https://schema.org/DataFeed)** — schema.org (spec, URL verified 2026-08-20)
  - DataFeed = 'a single feed providing structured information about one or more entities or topics'; hierarchy Thing > CreativeWork > Dataset > DataFeed; primary property dataFeedElement accepting DataFeedItem/Text/Thing; DataFeedItem examples use dateCreated, dateModified, item. Adoption is only 1K-10K domains per Google's web index (July 2026 aggregation) — too thin to score against.

## Example failure

A WordPress site with the PubSubHubbub plugin emits `<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>` alongside `<atom:link rel="self" href="/feed/"/>` — a relative href. Every hub subscription attempt fails verification because the topic URL cannot be resolved to the canonical feed, so the site has push infrastructure installed, a plugin reporting success, and zero actual fanout.

## Scoring

Tier per evidence policy: **scored (weight 0.6)**, ternary. A broken advertisement is a `warn`, never a `fail`; a site with no hub is not judged.

**Grade: B** — Google Search documents WebSub as a way to "broadcast your changes to search engines, including Google" (verified 2026-10-18). That is a named consumer reading the push path. It is Google Search's crawl, not an LLM vendor, which is the same footing as `machine-discovery/rss-feed` (B). No AI answer engine documents subscribing to a hub, so the grade stops at B.

## Implementation deviations

- **Renamed** from `websub-hub-advertisement-and-self-link-correctness`, which
  exceeds the 64-character id cap. Both halves ship.
- **Nothing here is a failure.** A broken advertisement degrades push to
  polling and does not remove the feed, so every finding is a `warn`. A test
  asserts no input produces `fail`.
- **Re-graded C/informative to B/scored on 2026-10-18.** The Google sitemap
  page names Google Search as a WebSub consumer. Absence was already
  `notApplicable`, so a site without a hub is not penalised.
- **2026-10-18 review: http hubs and refused probes.** Now that the audit is
  scored, two warnings cost score without a source: WebSub does not require an
  HTTPS hub, and a 401, 403 or 429 to the scanner's HEAD is a refusal, not a
  missing hub. Both now pass. A relative hub URL, no response, 404, 410 and
  5xx still warn.
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
- **A feed with no hub is `notApplicable`.** It used to warn ("every
  subscriber falls back to polling"). Google documents WebSub as optional,
  so absence is not a defect. Only feeds that advertise a hub are judged.
- **The self link is not compared with the fetch URL.** It used to warn when
  they differed. The Recommendation says the topic URL "may be different
  from the URL that was used to make the discovery request".
- **HTML page discovery links are not read.** WebSub's examples put them in the
  feed, and an HTML topic would need its own self-link comparison.
- **Only the WebSub Recommendation and Google's sitemap page bear on this
  audit.** The RFC 4287 and schema.org DataFeed sources carry nothing here.
