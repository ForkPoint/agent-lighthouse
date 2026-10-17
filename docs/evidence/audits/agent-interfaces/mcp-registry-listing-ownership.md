---
audit: agent-interfaces/mcp-registry-listing-ownership
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-registry-listing-ownership.ts
slug: mcp-registry-listing-ownership
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - mcp-registry-authentication
  - mcp-registry-about
  - mcp-official-registry-api
---

# Registry Listing and Namespace Ownership Proof

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Checks two things about the site's MCP server. Whether it is discoverable in the official MCP Registry. And whether it is listed under the reverse-DNS namespace of the audited domain, which the registry grants only on proof of domain control. Together they distinguish a first-party listing from a third-party aggregator's republish of the same server.

The namespace match is the ownership signal. The registry checks the proof when the publisher logs in, by DNS TXT record or by HTTP file, and neither has to stay published. So the audit reports whether `/.well-known/mcp-registry-auth` is served, but a missing file never fails a listing. A file that is served but malformed is a warning.

## Claimed mechanism (falsifiable)

The registry grants a `com.example.*` namespace only on proof of domain control, and the proof is externally observable: either an apex DNS TXT record of exact form `v=MCPv1; k=ed25519; p=<base64>` or a file at exactly `/.well-known/mcp-registry-auth` with the same payload. A listing under `io.github.<user>/*` is bound to an individual's GitHub account, and a listing under an aggregator namespace (observed live in the registry as e.g. `ai.smithery/<Org>-<repo>` with `remotes[].url` pointing at server.smithery.ai) is bound to neither the brand nor its infrastructure — the brand cannot update or revoke it, and agents routed through it reach a proxy rather than the origin. The proof is checked at login, not on every read, so a listing in the domain's namespace is itself the evidence that control was proved once. The falsifiable claim: a domain with no first-party registry entry is absent from the official index that downstream marketplaces and sub-registries pull from, so clients that read those catalogs never see the domain's own server.

## Evidence

- **[How to Authenticate When Publishing to the Official MCP Registry](https://modelcontextprotocol.io/registry/authentication)** — Model Context Protocol (vendor-doc, verified 2026-10-17)
  - GitHub authentication binds a server name to `io.github.<user or org>/*`. Domain authentication binds it to `com.example.*/*`, the reverse-DNS form of the domain.
  - Domain control is proved by a DNS TXT record `v=MCPv1; k=ed25519; p=<key>`, or by the same payload served at `https://<domain>/.well-known/mcp-registry-auth`.
  - Both methods are checked when the publisher runs `mcp-publisher login`. The guide gives no step that keeps either proof published after login, so a domain that proved control by TXT alone serves no file and is still a legitimate owner.
- **[The MCP Registry](https://modelcontextprotocol.io/registry/about)** — Model Context Protocol (vendor-doc, verified 2026-10-17)
  - The official metadata repository for public MCP servers, backed by Anthropic, GitHub, PulseMCP and Microsoft. It offers "A REST API for MCP clients and aggregators to discover available servers".
  - Namespace authentication "ensures that only the legitimate owner of a GitHub account or domain can publish servers under that namespace".
- **[Official MCP Registry API](https://registry.modelcontextprotocol.io/v0/servers)** — Model Context Protocol (spec, verified 2026-10-17)
  - Public and unauthenticated. A search returns each listing's name, `remotes[].url`, status and version, which is what the audit reads.

**Grade: B** — the registry and its namespace rules are documented by the protocol's maintainers, and the listing is directly observable. The registry is still in preview, and its documented consumers are aggregators rather than agents, so the grade is B rather than A.

**Counter-evidence:** The registry says it "is not intended to be directly consumed by host applications". Agents reach it through downstream marketplaces and sub-registries, so a missing listing hides a server from those catalogs, not from an agent given the URL. The registry is labelled preview: "Breaking changes or data resets may occur before general availability." The audit cannot see a DNS TXT proof, and it does not verify the registry's signature over the entry. It trusts the registry's namespace grant instead.

## Example failure

A B2B analytics vendor runs a solid MCP server at https://analytics.example.com/mcp. Searching the registry for 'example.com' returns exactly one match: `ai.smithery/example-analytics`, whose remotes[].url is https://server.smithery.ai/@example/analytics/mcp and whose headers[] demand a Smithery API key. The vendor has no first-party listing, serves no /.well-known/mcp-registry-auth, and has no apex TXT proof. Agents resolving 'the MCP server for example.com' from the canonical registry are routed through a third party the vendor has no contractual relationship with, cannot revoke, and cannot update when the endpoint moves.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- 2026-10-17: the `## Evidence` block used to cite four accessibility and DOM-parsing sources that do not touch the MCP Registry. It now cites the registry's own authentication guide, overview and API.
- No pagination. The audit reads the first page of at most two searches, the apex and the brand token.
- Version drift against `server/discover` is not compared. The audit reports the registry's own `status` and `isLatest`.
- `remotes[].url` is not probed. Those URLs come from a third-party document.
- Only the aggregator case fails. An `io.github.<user>` listing is held by someone who can update it, so it does not fail.
- The proof is fetched at `https://<apex>/.well-known/mcp-registry-auth`, not read from the scan's root files. The namespace binds to the apex, not the scanned host.
- 2026-10-17: a first-party listing no longer fails when the proof file is absent or malformed. The authentication guide checks the proof at login by DNS TXT or HTTP file and requires neither to persist, so a TXT-only domain was failed wrongly. An absent file is reported in `details.ownershipProof` only. A malformed one is a warning.

## Deferred

- The DNS TXT leg of the proof. Audits make no DNS queries and no gatherer reads TXT records. It does not affect the verdict, since the proof file is reported but never required.
- Verifying the registry's signature over the entry.
