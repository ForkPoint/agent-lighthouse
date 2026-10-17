---
audit: machine-discovery/feed-entry-identity-and-canonical-integrity
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/feed-entry-identity-and-canonical-integrity.ts
slug: feed-entry-identity-and-canonical-integrity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - rfc4287
  - rss-2-specification
  - google-consolidate-duplicate-urls
---

# Feed entry identity and canonical integrity

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `multi-page`

## What it checks

Validates that RSS/Atom entries carry stable, unique identifiers and that the URL each entry points at is the same URL the target page declares canonical — so an agent that cites a feed item cites a resolvable, non-deduplicated address.

## Claimed mechanism (falsifiable)

RFC 4287 makes atom:id mandatory, exactly one per entry, 'permanent, universally unique' and unchanging 'across different instantiations of the entry'; atom:updated is likewise mandatory and must mark the last significant modification. Ingestion pipelines dedupe and diff on these values. Falsifiable claim, in two parts. When ids are unstable — regenerated per build, or derived from a URL that includes tracking parameters — every poll re-emits the whole feed as new, and consumers either re-ingest duplicates or rate-limit the feed away. And when an entry's <link> or atom:link href differs from the target page's rel=canonical, an agent quoting the feed cites a URL that redirects or is consolidated away, which breaks attribution. Both are directly measurable without knowing anything about the consumer.

## Evidence

- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id and exactly one atom:updated. The id is a permanent, universally unique IRI that 'must not change across different instantiations of the entry'. The updated time is the 'most recent modification time that the publisher considers significant'. atom:entry MUST also contain atom:summary in two cases: when atom:content carries a src attribute, and is thus empty, and when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[RSS 2.0 Specification](https://www.rssboard.org/rss-specification)** — RSS Advisory Board (spec, verified 2026-10-17)
  - `<guid>` is a string that uniquely identifies the item. Aggregators may use it to decide whether an item is new. `isPermaLink` defaults to true, and then the reader may assume the guid is a permalink to the item. This is the rule behind the check that a permalink guid is an absolute URL.
- **[Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)** — Google Search Central (vendor-doc, verified 2026-10-17)
  - `rel="canonical"` is a strong signal of which URL should become canonical, and a redirect is a strong signal that its target should. The page uses a `gclid` tracking URL as its example of a non-preferred duplicate. A feed link that redirects, or that differs from the page's canonical, therefore advertises an address Google consolidates away.

## Example failure

A headless CMS emits `<guid>https://example.com/blog/post?preview_id=8812</guid>` and `<link>https://example.com/blog/post?utm_source=rss</link>` while the page declares `rel=canonical https://example.com/blog/post`. Every consumer stores the utm-tagged URL; an answer engine citing the article links to a URL that 301s, and analytics-driven URL rotation changes the guid on republish so the same article is ingested three times as three distinct documents.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- **Feeds come from the shared `gatherers/feeds.ts`**, capped at two. Each
  feed is fetched once per scan across the feed audits.
- **Autodiscovery is not gated on root-text-file integrity.** A feed that
  parses as a feed already proves the path resolved.
- **One entry produces one finding.** A canonical mismatch names the tracking
  parameters too. The tracking arm fires alone only when the page declares no
  canonical.
- **A generic `application/xml` or `text/xml` is noted, not scored.** It goes
  under `details.warnings` and the audit still passes. A non-XML type such as
  `text/html` fails.
- **The newest-five selection uses only timezone-carrying dates.** Entries
  without an offset sort last. Their identity is still checked.
- **Only the five newest entries get a canonical comparison.** Each costs a
  page fetch.
- **Id stability is not re-fetched within a scan.** Ids only regenerate across
  a deploy.
- **The stub-feed length ratio** belongs to `machine-discovery/rss-feed-content`.
- **JSON Feed** gets the duplicate-id, missing-id and link rules. It has no
  `isPermaLink` or summary-when-src rule to assert.
- **Sources.** RFC 4287 §4.1.2 and the RSS 2.0 `<guid>` rule carry the
  identity assertions. Google's duplicate-URL guidance carries the canonical
  and redirect assertions.
