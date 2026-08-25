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

RSL 1.0 mandates explicit association — it defines no default or well-known location, so a valid rsl.xml sitting at an unreferenced URL is undiscoverable by specification (s12). Each discovery channel has exact conformance requirements that silently break the chain when violated: robots.txt `License:` 'value MUST be an absolute URI'; the HTTP `Link` header and the HTML `<link>` both require `rel="license"` AND `type="application/rsl+xml"`. A licensing crawler filtering Link headers on the media type will not follow a link served as `text/xml`. Falsifiable: given a site with licensing intent, either at least one conformant channel resolves to a parseable RSL document whose `<content url>` prefix covers the audited URL, or the terms are unreachable.

## Evidence

- **[RSL 1.0 Standard Specification](https://rslstandard.org/rsl)** — RSL Collective (spec, URL verified 2026-08-20)
  - robots.txt directive `License: https://example.com/license.xml` — "The value MUST be an absolute URI"; may be global or inside a User-agent group; multiple allowed. HTTP discovery: `Link: <https://example.com/license.xml>; rel="license"; type="application/rsl+xml"`. HTML: `<link rel="license" type="application/rsl+xml" href="...">` or inline `<script type="application/rsl+xml">`. no default/well-known location is mandated. XML: root `<rsl xmlns="https://rslstandard.org/rsl" max-age>`, `<content url required, server, encrypted>`, `<license>`, `<permits|prohibits type="usage|user|geo">`, `<payment type="purchase|subscription|crawl|use|attribution|free">`, `<amount currency=ISO4217>`, `<standard>`, `<copyright type contactEmail contactUrl>`, `<legal type="warranty|disclaimer|attestation|contact|proof">`.
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

## Implementation deviations

**Renamed.** The proposal's slug — `rsl-licensing-terms-discoverable-and-conformant` —
is 46 characters, and with the `access-crawl-control/` prefix the id would be
67, over the 64-character cap `schemas.ts` enforces. The audit ships as
`rsl-licensing-terms-conformance`; the proposal's name survives as the title.

All six steps of the sketch ship. Three decisions it leaves open.

**Conventional paths are probed only when nothing advertised a licence.** The
sketch calls the probe optional. Probing unconditionally would cost two requests
on every scan of a site that already told us where its licence is. A document
found only that way is reported as present but not discoverable, which is a
warning rather than a pass: RSL mandates no default location, so no crawler is
obliged to look there.

**A relative `License:` value is reported, never resolved.** The spec says the
value MUST be an absolute URI. Resolving it would hide the defect behind the
scanner's own helpfulness, and a crawler that follows the spec sees nothing.

**Coverage is checked against the pages this scan actually read.** The sketch
says the prefix must cover "the audited page paths", and those are the sampled
URLs. A licence whose `<content url>` covers a section the scan did not sample
is neither confirmed nor faulted.

The 402 cross-check the sketch's step 6 describes lives in
`access-crawl-control/machine-actionable-402-paid-access`, which is where the
402 responses are: that audit requires a `<payment type="crawl">` when a 402 is
observed, rather than this one guessing whether any 402 exists.

## Deferred

- **`max-age` and `<legal>`.** Both are spec elements this audit does not
  validate. Neither changes whether a crawler can read the terms.
- **Encrypted and server-scoped content.** `<content encrypted>` and
  `<content server>` describe delivery paths a scanner cannot exercise.
- **More than three documents.** A site pointing at more licences than that has
  a discovery problem this audit cannot untangle from outside; the first three
  are read and the rest counted.
