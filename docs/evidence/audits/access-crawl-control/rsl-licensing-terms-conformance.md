---
audit: access-crawl-control/rsl-licensing-terms-conformance
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/rsl-licensing-terms-conformance.ts
slug: rsl-licensing-terms-conformance
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - s12
  - s13
---

# RSL licensing terms discoverable and conformant

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Validates that a site publishing content-licensing terms does so in a form an AI licensing agent can actually find and parse. That means an RSL 1.0 document reachable through at least one of the four spec-defined discovery channels, with a well-formed body whose content scope actually covers the audited pages.

## Claimed mechanism (falsifiable)

RSL 1.0 mandates explicit association — it defines no default or well-known location, so a valid rsl.xml sitting at an unreferenced URL is undiscoverable by specification (s12). Each discovery channel has exact conformance requirements that silently break the chain when violated: robots.txt `License:` 'value MUST be an absolute URI'; the HTTP `Link` header and the HTML `<link>` both require `rel="license"` and `type="application/rsl+xml"`. A licensing crawler filtering Link headers on the media type will not follow a link served as `text/xml`. Falsifiable: given a site with licensing intent, either at least one conformant channel resolves to a parseable RSL document whose `<content url>` prefix covers the audited URL, or the terms are unreachable.

## Evidence

- **[RSL 1.0 Standard Specification](https://rslstandard.org/rsl)** — RSL Collective (spec, URL verified 2026-08-20)
  - robots.txt directive `License: https://example.com/license.xml` — "The value MUST be an absolute URI"; may be global or inside a User-agent group; multiple allowed. HTTP discovery: `Link: <https://example.com/license.xml>; rel="license"; type="application/rsl+xml"`. HTML: `<link rel="license" type="application/rsl+xml" href="...">` or inline `<script type="application/rsl+xml">`. no default/well-known location is mandated. XML: root `<rsl xmlns="https://rslstandard.org/rsl" max-age>`, `<content url required, server, encrypted>`, `<license>`, `<permits|prohibits type="usage|user|geo">`, `<payment type="purchase|subscription|crawl|use|attribution|free">`, `<amount currency=ISO4217>`, `<standard>`, `<copyright type contactEmail contactUrl>`, `<legal type="warranty|disclaimer|attestation|contact|proof">`.
- **[Really Simple Licensing (RSL) — home](https://rslstandard.org/)** — RSL Collective (spec, URL verified 2026-08-20)
  - RSL 1.0 released; open standard for machine-readable licensing incl. attribution, pay per crawl, pay per inference. Supporters listed: Akamai, Cloudflare, Creative Commons, Fastly, Reddit, O'Reilly Media, Vox Media, Yahoo, Ziff Davis. Discovery via rsl.xml files, robots.txt, HTTP headers, HTML, RSS, media files, plus an Encrypted Media Standard.

## Example failure

A publisher adopts RSL and adds `License: /license.xml` to robots.txt. The spec requires an absolute URI, so conformant parsers discard the directive; meanwhile /license.xml is served as `text/xml`, so the HTTP `Link` channel's `type="application/rsl+xml"` filter also drops it. The licensing terms — including a `<payment type="crawl">` rate the publisher wants honoured — are invisible to every RSL-aware agent while looking perfectly correct in a browser.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The id is `rsl-licensing-terms-conformance`. The proposal's slug would exceed the 64-character id cap. Its name survives as the title.
- `/license.xml` and `/rsl.xml` are probed only when nothing advertised a licence. A document found only that way warns as present but not discoverable.
- A probed path counts only when its body has an `<rsl>` element. A redirect to the homepage is absent, not a malformed licence. A redirect to a real RSL document still counts. Advertised candidates are not filtered, so a `License:` line pointing at HTML still fails.
- A relative `License:` value is reported, never resolved. The spec requires an absolute URI.
- Coverage is checked against the pages this scan read. A `<content url>` covering an unsampled section is neither confirmed nor faulted.
- The 402 cross-check lives in `access-crawl-control/machine-actionable-402-paid-access`, where the 402 responses are.

## Deferred

- **`max-age` and `<legal>`.** Neither is validated. Neither changes whether a
  crawler can read the terms.
- **Encrypted and server-scoped content.** `<content encrypted>` and
  `<content server>` describe delivery paths a scanner cannot exercise.
- **More than three documents.** The first three are read and the rest counted.
