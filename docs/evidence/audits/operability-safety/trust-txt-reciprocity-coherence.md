---
audit: operability-safety/trust-txt-reciprocity-coherence
category: operability-safety
source_file: packages/core/src/audits/operability-safety/trust-txt-reciprocity-coherence.ts
slug: trust-txt-reciprocity-coherence
evidence_grade: C
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S1
---

# trust.txt reciprocity and AI-policy coherence

> Shipped in v2. Evidence grade **C** · informative tier · unique · implementation: `multi-page`

## What it checks

ROADMAP / UNSCORED. Parses trust.txt for publishers who maintain one, validating attribute names, resolving the reciprocal member=/belongto= relationships across domains, and cross-checking the datatrainingallowed= declaration against what robots.txt actually tells AI crawlers. Reported as an informational trust signal, never scored.

## Claimed mechanism (falsifiable)

trust.txt's association attributes are defined as reciprocal: belongto=<association> is only meaningful if that association's own trust.txt lists member=<this domain>. That reciprocity is mechanically checkable across two HTTP fetches, which makes the association claim falsifiable rather than self-asserted. Independently, datatrainingallowed= and robots.txt AI-bot directives express the same policy through two channels. A site declaring datatrainingallowed=no, while leaving GPTBot, ClaudeBot and PerplexityBot unrestricted in robots.txt, is therefore stating contradictory policy. The machine-readable channel that actually gates crawlers says the opposite of the human-facing declaration. One limitation, stated plainly: no evidence was found that any AI engine, answer engine or crawler consumes trust.txt, and the JournalList reference document itself publishes no adoption statistics and names no consumer. The mechanism is internally sound; the consumer does not demonstrably exist.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Example failure

A regional news site publishes trust.txt with datatrainingallowed=no and belongto=https://example-press-association.org/. That association's trust.txt has no member= line for the site, so the membership claim is uncorroborated; meanwhile robots.txt has no GPTBot or ClaudeBot rules at all, so the site's only enforceable channel grants exactly the training access its declaration refuses.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Implementation deviations

- The slug is shortened from `trust-txt-reciprocity-and-ai-policy-coherence`, which would make a 63-character id.
- No code path returns `fail`, and a test asserts it across every input. The audit is informative at weight 0, and no consumer of the standard is documented.
- At most three associations are resolved. The finding says how many were skipped.
- The robots.txt comparison uses `parseRobots` and `isPathAllowed` from `gatherers/robots.ts`, as the `access-crawl-control` audits do.

## Deferred

- `social=` verification. It needs a third-party social profile fetched, which needs a headless browser.
- Cross-scan caching of association documents. The cache is per scan.
