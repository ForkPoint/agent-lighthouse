---
audit: operability-safety/organization-identifier-registry-resolution
category: operability-safety
source_file: packages/core/src/audits/operability-safety/organization-identifier-registry-resolution.ts
slug: organization-identifier-registry-resolution
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S4
  - S3
  - S9
  - S13
---

# Organization identifier resolves in the authoritative registry

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Validates the machine-verifiable legal identity of the publishing organization end to end: correct modern encoding of the identifier, live resolution against GLEIF's public registry, active registration status, and agreement between the registered legal name and the name in the markup. This is the identity signal that matters for shopping and payment agents transacting with an unfamiliar merchant.

## Claimed mechanism (falsifiable)

leiCode / iso6523Code 0199: is the only organization identifier in schema.org backed by a free, authoritative, queryable registry, so it is the only one whose truth an auditor can independently establish. Google separately documents a specific encoding preference: it 'encourage[s] using the iso6523Code field with prefix 0199: instead' of leiCode, and 0060: instead of duns. FALSIFIABLE on three axes: (a) the identifier is syntactically invalid, (b) GLEIF returns no record or a non-ISSUED registration, (c) GLEIF's registered legalName disagrees with the schema.org name/legalName. Each is a hard pass/fail against an external authority, not an opinion.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.

## Example failure

A marketplace publishes leiCode on its about page. GLEIF resolves the code to a dormant Delaware holding entity with registration.status LAPSED and a legalName sharing no tokens with the consumer-facing brand in the markup. A shopping agent asked to verify the merchant before checkout finds an identifier that technically exists but corroborates nothing — worse than publishing none, because it manufactures false confidence.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The id is shortened. The proposal's name would make a 78-character id.
- Every Organization node on every crawled page is read, not only the homepage and one about page. The same LEI seen twice costs one lookup.
- A LAPSED, RETIRED or ANNULLED registration warns. Any other status besides `ISSUED` fails, because the audit cannot vouch for it. An entity status other than `ACTIVE` warns.
- A missing GLEIF record fails. A registry error such as a 503 warns, because it says nothing about the site.
- The lookup goes through `ctx.fetch` (via `probeSecurityUrl` in `gatherers/security.ts`), so the SSRF gate, timeout and budget apply.

## Deferred

- **Cross-scan cache.** The suggested 30-day per-LEI cache needs a store the scanner does not have. The cache is per scan.
- **`registration.corroborationLevel` and `nextRenewalDate`** could be surfaced as trust context. Neither changes a verdict.
- **DUNS resolution.** Dun & Bradstreet publishes no free authoritative lookup. The `0060:` advisory checks encoding only.
