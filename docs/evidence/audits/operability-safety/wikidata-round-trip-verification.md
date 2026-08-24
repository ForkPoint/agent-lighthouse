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
  - S4
  - S8
  - mcp-spec-2025-06-18-transports
---


# Wikidata round-trip entity verification

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Turns the self-asserted sameAs array into a two-way, machine-verifiable identity proof. Extracts the Wikidata Q-id a site claims in its Organization/Person JSON-LD, then asks Wikidata whether that entity points back at this domain via P856 (official website). One-way claims are unverifiable by construction; only the round trip is evidence.

## Claimed mechanism (falsifiable)

schema.org sameAs is a self-asserted outbound link — Google documents it purely as 'a URL of a page on another website with additional information about your organization', with no reciprocity requirement, so any site can claim any entity. A knowledge-graph consumer that grounds a brand to an entity needs corroboration from the authority side. Wikidata exposes exactly that corroboration for free via P856. FALSIFIABLE: for each claimed Q-id, fetch P856 and compare registrable domains; a claim whose authority record points to an unrelated registrable domain is either the wrong entity or an unbacked identity claim. The check would be wrong if Wikidata P856 were absent or unreliable for the general population of notable organizations.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).
- **[MCP Specification 2025-06-18 — Transports (superseded baseline)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - The legacy-era shape used for backward-compat detection: Mcp-Session-Id assigned in the InitializeResult, GET opens a standalone SSE stream or returns 405, DELETE terminates a session, Last-Event-ID resumability, and servers SHOULD assume 2025-03-26 when MCP-Protocol-Version is absent. Also documents the deprecated 2024-11-05 HTTP+SSE detection path (GET returns an `endpoint` event as the first SSE event).

## Competitor coverage

Every SEO tool validates that sameAs is a well-formed URL array; none dereferences the target and none checks reciprocity. Lighthouse's agentic category has no entity checks whatsoever. Profound/Otterly observe brand mentions in answers but do not audit the site's own entity claims. Bidirectional authority verification is unshipped across the entire category.

## Implementation sketch

1) Parse all JSON-LD blocks including @graph, collect Organization/Person/NewsMediaOrganization nodes and their sameAs values. 2) Filter to authority hosts: wikidata.org, *.wikipedia.org, gleif.org, LinkedIn company pages, GitHub orgs. 3) Wikidata: extract the Q-id from /wiki/Q\d+ or /entity/Q\d+, then GET https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=<Qid>&property=P856&format=json and read claims.P856[*].mainsnak.datavalue.value — use the per-property endpoint, not Special:EntityData, whose full export is enormous for popular entities. 4) Respect statement rank: prefer 'preferred', ignore 'deprecated'. 5) Compare using the Public Suffix List registrable domain, NOT string equality — Q95 (Google) resolves to https://about.google/, so also accept a configured alias set and treat a same-organization-different-TLD result as WARN rather than FAIL. 6) Wikipedia sameAs: resolve the article to its Q-id via the Wikipedia API sitelinks, then run the same round trip. 7) Verdicts: PASS = P856 registrable domain matches; WARN = entity exists but has no P856 (unverifiable); FAIL = P856 points at a different organization's domain. Cache per Q-id for 30 days.

## Example failure

A SaaS company's Organization JSON-LD lists sameAs: https://www.wikidata.org/wiki/Q12345 — but Q12345 is a same-named defunct hardware manufacturer whose P856 points at a parked domain. The site has been actively mis-grounding itself to the wrong knowledge-graph entity for years; every downstream consumer that trusts sameAs inherits the wrong company's facts, and no existing structured-data validator flags it because the markup is syntactically perfect.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `wikidata-round-trip-entity-verification` for symmetry with
its siblings; the id was inside the cap either way.

Steps 1 and 3 to 7 of the sketch ship: `sameAs` collected from Organization,
Corporation, NewsMediaOrganization, LocalBusiness, Person and Brand nodes
across every JSON-LD block including `@graph`; the Q-id read from both the
`/wiki/Q…` and `/entity/Q…` forms; one `wbgetclaims` call per entity for
P856 alone, never `Special:EntityData`; statement rank respected, with
`preferred` winning and `deprecated` ignored; registrable-domain comparison
rather than string equality; and the three verdicts — verified, same name
under another domain (warn), other organization's domain (fail) — plus a warn
when the entity carries no P856 at all.

**Only Wikidata is resolved** (sketch step 2 named several authority hosts,
step 6 added Wikipedia). Wikidata is the one with a free, documented,
per-property endpoint and a reciprocal property. Resolving a Wikipedia article
to its Q-id would cost a second request per claim through a different API for
the same answer, and GLEIF round trips are
`operability-safety/organization-identifier-registry-resolution`.

**Registrable-domain comparison lives in `gatherers/domains.ts`.** Two audits
already carried a private copy of the eTLD+1 reduction; the third is where a
shared one earns its place. It uses a short public-suffix set rather than a
bundled PSL snapshot, and the module says why.

**At most two entities are resolved per scan.** A site claiming three
identities has an identity problem this audit reports off two of them.

## Deferred

- **Wikipedia `sameAs` round trips** through the sitelinks API.
- **The 30-day per-Q-id cache** the sketch suggests. The scanner has no
  cross-scan store; the cache here is per scan.
- **A configurable alias set** for organizations whose official domain
  legitimately differs from the audited one. The same-name-different-TLD case
  is a warning instead, which is the outcome an alias set would produce.
