---
audit: operability-safety/wikidata-round-trip-verification
category: operability-safety
source_file: packages/core/src/audits/operability-safety/wikidata-round-trip-verification.ts
slug: wikidata-round-trip-verification
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - schemaorg-sameas
  - google-organization-schema
  - wikidata-p856
  - wikidata-wbgetclaims
---

# Wikidata round-trip entity verification

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Turns the self-asserted sameAs array into a two-way, machine-verifiable identity proof. Extracts the Wikidata Q-id a site claims in its Organization/Person JSON-LD, then asks Wikidata whether that entity points back at this domain via P856 (official website). One-way claims are unverifiable by construction; only the round trip is evidence.

- At most two claimed entities are resolved per scan.
- The entity's best-ranked P856 on this site's registrable domain passes.
- P856 on an unrelated domain fails.
- The same name under a different domain, or no P856 at all, warns.
- No Wikidata `sameAs` on any identity node is not applicable.
- When Wikidata does not answer, that entity is listed as unverified and does not decide the verdict. If no entity could be read, the result is not applicable.

## Claimed mechanism (falsifiable)

schema.org sameAs is a self-asserted outbound link — Google documents it purely as 'a URL of a page on another website with additional information about your organization', with no reciprocity requirement, so any site can claim any entity. A knowledge-graph consumer that grounds a brand to an entity needs corroboration from the authority side. Wikidata exposes exactly that corroboration for free via P856. FALSIFIABLE: for each claimed Q-id, fetch P856 and compare registrable domains; a claim whose authority record points to an unrelated registrable domain is either the wrong entity or an unbacked identity claim. The check would be wrong if Wikidata P856 were absent or unreliable for the general population of notable organizations.

## Evidence

- **[schema.org: sameAs](https://schema.org/sameAs)** — schema.org (spec, URL verified 2026-08-20)
  - "URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Wikidata entry, or official website." A Wikidata entry is a named identity reference.
- **[Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)** — Google Search Central (vendor-doc, verified 2026-10-17)
  - Google documents `sameAs` as "The URL of a page on another website with additional information about your organization, if applicable." The page sets no reciprocity requirement and does not mention Wikidata. The claim is one-way.
- **[Wikidata property P856 — official website](https://www.wikidata.org/wiki/Property:P856)** — Wikidata (dataset, verified 2026-10-17)
  - "URL of the official page of an item (current or former)", datatype URL. This is the authority-side record the round trip reads.
- **[Wikidata API — wbgetclaims](https://www.wikidata.org/w/api.php?action=help&modules=wbgetclaims)** — Wikidata (vendor-doc, verified 2026-10-17)
  - Returns an entity's claims, filtered to one property, with each claim's rank: deprecated, normal or preferred. The audit reads P856 alone and skips deprecated statements.

Counter-evidence: no search engine or AI vendor documents checking that a claimed Wikidata entity points back at the site. The sources above define the two halves of the round trip. None documents a consumer that performs it.

## Example failure

A SaaS company's Organization JSON-LD lists sameAs: https://www.wikidata.org/wiki/Q12345 — but Q12345 is a same-named defunct hardware manufacturer whose P856 points at a parked domain. The site has been actively mis-grounding itself to the wrong knowledge-graph entity for years; every downstream consumer that trusts sameAs inherits the wrong company's facts, and no existing structured-data validator flags it because the markup is syntactically perfect.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Only Wikidata is resolved. It has a free, documented per-property endpoint and a reciprocal property. GLEIF round trips belong to `operability-safety/organization-identifier-registry-resolution`.
- One `wbgetclaims` call per entity reads P856 alone. `Special:EntityData` is never used.
- Registrable-domain comparison uses `gatherers/domains.ts`, with a short public-suffix set rather than a bundled PSL.
- At most two entities are resolved per scan.

## Deferred

- Wikipedia `sameAs` round trips through the sitelinks API.
- A cross-scan cache per Q-id. The cache is per scan.
- A configurable alias set. A same-name, different-TLD result warns instead.
