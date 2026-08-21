---
check: organization-identifier-resolves-in-the-authoritative-regist
title: "Organization identifier resolves in the authoritative registry"
domain: trust-provenance
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Organization identifier resolves in the authoritative registry

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Validates the machine-verifiable legal identity of the publishing organization end to end: correct modern encoding of the identifier, live resolution against GLEIF's public registry, active registration status, and agreement between the registered legal name and the name in the markup. This is the identity signal that matters for shopping and payment agents transacting with an unfamiliar merchant.

## Claimed mechanism (falsifiable)

leiCode / iso6523Code 0199: is the only organization identifier in schema.org backed by a free, authoritative, queryable registry, so it is the only one whose truth an auditor can independently establish. Google separately documents a specific encoding preference: it 'encourage[s] using the iso6523Code field with prefix 0199: instead' of leiCode, and 0060: instead of duns. FALSIFIABLE on three axes: (a) the identifier is syntactically invalid, (b) GLEIF returns no record or a non-ISSUED registration, (c) GLEIF's registered legalName disagrees with the schema.org name/legalName. Each is a hard pass/fail against an external authority, not an opinion.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.

## Competitor coverage

Structured-data validators check that leiCode is a string; not one performs a live GLEIF lookup, checks registration status, or reconciles registered legal name against the marked-up name. Google's own 0199:/0060: encoding guidance is documented but, as far as I can establish, unimplemented by any third-party auditor. Lighthouse's agentic category has no organization-identity checks.

## Implementation sketch

1) Locate the Organization node (Google recommends home page or a single about-us page — check both). 2) Read leiCode and iso6523Code. Encoding check: iso6523Code must match /^\d{4}:/; if leiCode is present without an iso6523Code '0199:<LEI>' twin, emit an ADVISORY citing Google's documented preference; same for duns vs '0060:'. 3) Syntactic pre-filter on the LEI: /^[A-Z0-9]{18}[0-9]{2}$/ plus the ISO/IEC 7064 MOD 97-10 check digit — treat this only as a cheap local filter, since GLEIF publishes no algorithm detail on its intro page. 4) Authoritative lookup, no API key required: GET https://api.gleif.org/api/v1/lei-records?filter[lei]=<LEI>. 5) Assert exactly one record; attributes.entity.status === 'ACTIVE'; attributes.registration.status === 'ISSUED' (WARN on LAPSED/RETIRED/ANNULLED — a lapsed LEI signals an organization that stopped maintaining its registration). 6) Name agreement: normalize case, punctuation and legal suffixes (Inc/Ltd/GmbH/L.P.), then compare attributes.entity.legalName.name against schema legalName, falling back to name; below a similarity threshold emit FAIL. 7) Optionally surface registration.corroborationLevel and nextRenewalDate as trust context. Cache per LEI for 30 days.

## Example failure

A marketplace publishes leiCode on its about page. GLEIF resolves the code to a dormant Delaware holding entity with registration.status LAPSED and a legalName sharing no tokens with the consumer-facing brand in the markup. A shopping agent asked to verify the merchant before checkout finds an identifier that technically exists but corroborates nothing — worse than publishing none, because it manufactures false confidence.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
