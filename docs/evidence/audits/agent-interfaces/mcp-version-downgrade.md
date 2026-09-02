---
audit: agent-interfaces/mcp-version-downgrade
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-version-downgrade.ts
slug: mcp-version-downgrade
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S1
  - S3
---

# Version Downgrade Recoverability

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Negative-path probe that verifies the server fails correctly when handed a protocol version it does not support, and when the MCP-Protocol-Version header disagrees with the body's _meta. Both are MUST-level behaviors whose absence strands otherwise-compatible clients.

## Claimed mechanism (falsifiable)

With the handshake removed, one mechanism is left for a client to discover a mutually supported version mid-flight: the `UnsupportedProtocolVersionError`. The spec requires code -32022, with `data.supported[]` listing the server's versions, and instructs clients to select from that list and retry. A server that instead returns a 500, a generic -32600 or -32602, or a 400 with no `supported` array, gives the client nothing to downgrade to. A client whose preferred version is one revision ahead of the server's then fails permanently — even though a mutually supported version exists on both sides. Separately, the spec requires the header and the `_meta` value to agree, with a 400 and -32020 HeaderMismatch on divergence. A server that silently ignores the mismatch is trusting whichever source of truth its proxy layer did not. That is the exact split-brain the header-validation rules exist to prevent.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.

## Competitor coverage

No commercial SEO/AEO tool sends malformed JSON-RPC to a customer's MCP endpoint. MCP Inspector connects with a valid version and has no negative-path suite. The MCP conformance/validator efforts in the ecosystem target server SDK authors, not deployed sites, and none surface this as a site-level score.

## Implementation sketch

Probe A (unsupported version): repeat the server/discover POST with `MCP-Protocol-Version: 1900-01-01` AND `_meta.io.modelcontextprotocol/protocolVersion: "1900-01-01"` (they must agree so the failure is unambiguous). Assert HTTP 400, `error.code === -32022`, `Array.isArray(error.data.supported)`, `error.data.supported.length >= 1`, every entry matching /^\d{4}-\d{2}-\d{2}$/, and `error.data.requested === "1900-01-01"`. Cross-check `data.supported` against the `supportedVersions` returned by server/discover — a mismatch between the two is its own finding.
Probe B (header/body mismatch): POST with header `MCP-Protocol-Version: 2026-07-28` but `_meta` protocolVersion `2025-11-25`. Assert HTTP 400 with `error.code === -32020`. A 200 result here means the server never validates header against body.
Probe C (missing header): POST with no MCP-Protocol-Version header. Per spec the server either treats it as 2025-03-26 (dual-era, acceptable — record it) or rejects it per server validation; a 200 modern result with no header is a validation gap. Scoring: Probe A failure = critical; Probe B failure = high; Probe C = informational.

## Example failure

A SaaS vendor's server supports 2025-11-25 and 2026-07-28. Sent `1900-01-01`, its framework's generic error handler returns `500 Internal Server Error` with an HTML body. A client that prefers a hypothetical future revision receives no `supported` list, cannot downgrade, and marks the server permanently incompatible — despite 2026-07-28 being available on both ends. The same server also returns 200 for Probe B, so a gateway routing on the header while the app executes on the body can be made to disagree.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Recorded at graduation (2026-08-22, Plan 5 Task 30).

- **Probe C's finding is a `warn`, not a separate informational tier.** The sketch grades probe C "informational". This audit is scored and ternary, so a headerless request answered with a modern result is reported as a review item; a headerless request that is rejected, or treated as 2025-03-26, is recorded in the message and changes nothing. Nothing about probe C can fail the audit on its own.
- **The severities the sketch assigns are kept as failure priorities.** Probe A defects fail at `critical`, probe B's silent acceptance fails at `high`. A probe B rejection carrying the wrong error code is a `warn`, since the client still learns the request was refused.
- **Probe C keeps `_meta` at 2025-03-26.** Sending the current revision in the body while omitting the header would make a rejection ambiguous between "no header" and "header/body disagreement", which is what probe B already isolates.
- **`server/discover` comes from the shared per-scan cache** used by the other MCP audits, so the cross-check against `supportedVersions` costs no extra request.
- **An unreachable endpoint is `notApplicable`, not a failure**, because reachability is what `agent-interfaces/mcp-modern-era-reachability` scores.

## Deferred

- Retrying with a revision from `data.supported` to prove the downgrade actually completes. The audit verifies the client is _told_ how to recover, which is the MUST; exercising the retry would double the probe count for a claim the error already settles.
- Probing revisions between the impossible one and the current one to find the exact floor. `data.supported` is the server's own answer to that question, and it is already read and cross-checked.
