---
check: rsl-licensing-terms-discoverable-and-conformant
title: "RSL licensing terms discoverable and conformant"
domain: bot-auth-access
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# RSL licensing terms discoverable and conformant

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Validates that a site publishing content-licensing terms does so in a form an AI licensing agent can actually find and parse: an RSL 1.0 document reachable through at least one of the four spec-defined discovery channels, with a well-formed body whose content scope actually covers the audited pages.

## Claimed mechanism (falsifiable)

RSL 1.0 mandates explicit association — it defines no default or well-known location, so a valid rsl.xml sitting at an unreferenced URL is undiscoverable by specification (s12). Each discovery channel has exact conformance requirements that silently break the chain when violated: robots.txt `License:` 'value MUST be an absolute URI'; the HTTP `Link` header and the HTML `<link>` both require `rel="license"` AND `type="application/rsl+xml"`. A licensing crawler filtering Link headers on the media type will not follow a link served as `text/xml`. Falsifiable: given a site with licensing intent, either at least one conformant channel resolves to a parseable RSL document whose `<content url>` prefix covers the audited URL, or the terms are unreachable.

## Evidence

- **[RSL 1.0 Standard Specification](https://rslstandard.org/rsl)** — RSL Collective (spec, URL verified 2026-08-20)
  - robots.txt directive `License: https://example.com/license.xml` — "The value MUST be an absolute URI"; may be global or inside a User-agent group; multiple allowed. HTTP discovery: `Link: <https://example.com/license.xml>; rel="license"; type="application/rsl+xml"`. HTML: `<link rel="license" type="application/rsl+xml" href="...">` or inline `<script type="application/rsl+xml">`. NO default/well-known location is mandated. XML: root `<rsl xmlns="https://rslstandard.org/rsl" max-age>`, `<content url required, server, encrypted>`, `<license>`, `<permits|prohibits type="usage|user|geo">`, `<payment type="purchase|subscription|crawl|use|attribution|free">`, `<amount currency=ISO4217>`, `<standard>`, `<copyright type contactEmail contactUrl>`, `<legal type="warranty|disclaimer|attestation|contact|proof">`.
- **[Really Simple Licensing (RSL) — home](https://rslstandard.org/)** — RSL Collective (spec, URL verified 2026-08-20)
  - RSL 1.0 released; open standard for machine-readable licensing incl. attribution, pay per crawl, pay per inference. Supporters listed: Akamai, Cloudflare, Creative Commons, Fastly, Reddit, O'Reilly Media, Vox Media, Yahoo, Ziff Davis. Discovery via rsl.xml files, robots.txt, HTTP headers, HTML, RSS, media files, plus an Encrypted Media Standard.

## Competitor coverage

No auditing tool validates RSL. Lighthouse's agentic category has no licensing dimension at all. Profound and Otterly measure answer-engine share-of-voice and citations, not HTTP-level rights signals. Given RSL's backer list (Akamai, Cloudflare, Fastly, Reddit, Yahoo, Ziff Davis) this is a first-mover check with real adoption behind it.

## Implementation sketch

Static-fetch. 1) From /robots.txt collect every `License:` directive (file scope and per User-agent group); assert each value parses as an absolute URI — flag relative values as non-conformant rather than silently resolving them. 2) From the homepage and sampled pages, read `Link:` response headers, parse RFC 8288 params, and keep entries with rel=license AND type=application/rsl+xml. 3) Parse HTML for `<link rel="license" type="application/rsl+xml" href>` and for inline `<script type="application/rsl+xml">` blocks. 4) If no channel yields a candidate, optionally probe /license.xml and /rsl.xml — but report anything found only that way as 'present but not discoverable', since the spec mandates no default location. 5) Fetch each candidate and validate: root element `<rsl>` with `xmlns="https://rslstandard.org/rsl"`; response Content-Type is application/rsl+xml; at least one `<content url=…>`; the url prefix covers the audited page paths (a common bug is `<content url="/blog/">` while the site's articles live at `/articles/`); each `<license>` carries at least one of `<permits>`/`<prohibits>`/`<payment>`; every `<permits|prohibits>` has type in {usage,user,geo}; every `<payment>` has type in {purchase,subscription,crawl,use,attribution,free}; every `<amount>` has an ISO 4217 `currency` and a parseable decimal; `<copyright>` carries contactEmail or contactUrl. 6) Cross-check: if the site returns 402 anywhere (see the machine-actionable 402 check), require a `<payment type="crawl">` with an `<amount>`.

## Example failure

A publisher adopts RSL and adds `License: /license.xml` to robots.txt. The spec requires an absolute URI, so conformant parsers discard the directive; meanwhile /license.xml is served as `text/xml`, so the HTTP `Link` channel's `type="application/rsl+xml"` filter also drops it. The licensing terms — including a `<payment type="crawl">` rate the publisher wants honoured — are invisible to every RSL-aware agent while looking perfectly correct in a browser.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
