---
check: feed-entry-identity-and-canonical-integrity
title: "Feed entry identity and canonical integrity"
domain: feeds-indexing
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Feed entry identity and canonical integrity

> Proposed check. Evidence grade **B** · unique · implementation: `multi-page`

## What it checks

Validates that RSS/Atom entries carry stable, unique identifiers and that the URL each entry points at is the same URL the target page declares canonical — so an agent that cites a feed item cites a resolvable, non-deduplicated address.

## Claimed mechanism (falsifiable)

RFC 4287 makes atom:id mandatory, exactly one per entry, 'permanent, universally unique' and unchanging 'across different instantiations of the entry'; atom:updated is likewise mandatory and must mark the last significant modification. Ingestion pipelines dedupe and diff on these values. Falsifiable claim: when ids are unstable (regenerated per build, or derived from a URL that includes tracking parameters), every poll re-emits the whole feed as new, and consumers either re-ingest duplicates or rate-limit the feed away; and when an entry's <link>/atom:link href differs from the target page's rel=canonical, an agent quoting the feed cites a URL that redirects or is consolidated away, breaking attribution. Both are directly measurable without knowing anything about the consumer.

## Evidence

- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id (permanent, universally unique IRI that 'must not change across different instantiations of the entry') and exactly one atom:updated ('most recent modification time that the publisher considers significant'). atom:entry MUST contain atom:summary when atom:content carries a src attribute (and is thus empty), or when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)** — Google Search Central (vendor-doc, URL verified 2026-08-20)
  - Direct quote: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' lastmod 'should reflect the date and time of the last significant update to the page… an update to the copyright date is not [significant].' priority and changefreq are ignored. 50MB uncompressed / 50,000 URL limit per sitemap file.

## Competitor coverage

W3C Feed Validator checks RFC conformance but does not fetch the target pages or compare against rel=canonical. SEO suites largely ignore feeds; none of the AI-visibility tools (Profound, Otterly) audit feed identity or feed-link/canonical agreement. Lighthouse has no feed checks.

## Implementation sketch

1) Autodiscover feeds via <link rel="alternate" type="application/rss+xml|application/atom+xml|application/feed+json"> on the homepage and one article page, plus conventional paths /feed, /rss.xml, /atom.xml, /index.xml (gated on the root-text-file integrity flag). 2) Assert Content-Type matches the declared type and the body parses as XML/JSON without a BOM or leading whitespace. 3) Per entry, for the 20 newest: Atom — exactly one atom:id, exactly one atom:updated, and atom:summary present whenever atom:content has a src attribute or non-text/non-XML type (RFC 4287 MUST); RSS — a <guid>, and if isPermaLink is absent or 'true' the guid must be an absolute resolvable URL. 4) Assert ids are unique within the feed (FAIL on any duplicate) and that item link hrefs are absolute HTTPS. 5) Fetch the 5 newest item URLs; compare each item link, after stripping nothing, to the target page's <link rel="canonical"> and to the final URL after redirects. FAIL when the feed link differs from canonical, or 3xx-redirects, or carries utm_*/ref/fbclid parameters absent from canonical. 6) Re-fetch the feed once at the end of the audit run and assert ids for unchanged entries are byte-identical (catches per-build id regeneration within a single session only when a deploy intervenes; otherwise report as advisory). 7) ADVISORY sub-signal (not scored): median ratio of content:encoded/atom:content length to the target page's extracted main-content length; flag <0.25 as a stub feed, and escalate to a finding only when the target page's main content is absent from the raw HTML (JS-rendered), because then the stub feed is the only text an agent can get and it is insufficient.

## Example failure

A headless CMS emits `<guid>https://example.com/blog/post?preview_id=8812</guid>` and `<link>https://example.com/blog/post?utm_source=rss</link>` while the page declares `rel=canonical https://example.com/blog/post`. Every consumer stores the utm-tagged URL; an answer engine citing the article links to a URL that 301s, and analytics-driven URL rotation changes the guid on republish so the same article is ingested three times as three distinct documents.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
