---
check: trust-txt-reciprocity-and-ai-policy-coherence
title: "trust.txt reciprocity and AI-policy coherence"
domain: trust-provenance
status: proposed
evidence_grade: C
uniqueness: unique
difficulty: multi-page
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# trust.txt reciprocity and AI-policy coherence

> Proposed check. Evidence grade **C** · unique · implementation: `multi-page`

## What it checks

ROADMAP / UNSCORED. Parses trust.txt for publishers who maintain one, validating attribute names, resolving the reciprocal member=/belongto= relationships across domains, and cross-checking the datatrainingallowed= declaration against what robots.txt actually tells AI crawlers. Reported as an informational trust signal, never scored.

## Claimed mechanism (falsifiable)

trust.txt's association attributes are defined as reciprocal: belongto=<association> is only meaningful if that association's own trust.txt lists member=<this domain>. That reciprocity is mechanically checkable across two HTTP fetches, which makes the association claim falsifiable rather than self-asserted. Independently, datatrainingallowed= and robots.txt AI-bot directives express the same policy through two channels, so a site declaring datatrainingallowed=no while leaving GPTBot/ClaudeBot/PerplexityBot unrestricted in robots.txt is stating contradictory policy — the machine-readable channel that actually gates crawlers says the opposite of the human-facing declaration. HONEST LIMITATION: I found no evidence that any AI engine, answer engine or crawler consumes trust.txt, and the JournalList reference document itself publishes no adoption statistics and names no consumer. The mechanism is internally sound; the consumer does not demonstrably exist.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Competitor coverage

trust.txt is essentially unaudited by commercial tooling. Lighthouse does not touch it. The reciprocity resolution and the datatrainingallowed-vs-robots.txt coherence test are, to my knowledge, unimplemented anywhere — but so is any consumer of the standard, which is why this stays unscored.

## Implementation sketch

1) GET /trust.txt and /.well-known/trust.txt (the .well-known location was added to the spec in Sept 2020); absence is INFO, never a penalty. 2) Parse name=value lines, one per line, '#' comments; validate names against the spec set (member, belongto, control, controlledby, vendor, customer, disclosure, contact, social, datatrainingallowed) and flag unknown attributes. 3) Reciprocity: for each belongto=<url>, fetch that domain's trust.txt and assert a member= entry pointing back at the audited domain; report each unreciprocated association. Do the same in reverse for control=/controlledby=. 4) AI-policy coherence: parse robots.txt user-agent groups for the major AI crawlers and compare against datatrainingallowed=yes/no; emit a WARN on contradiction in either direction. 5) social= verification uses a trust://<domain>! string that must appear on the linked social profile — that requires fetching third-party profiles and is explicitly deferred to a headless-browser roadmap item. 6) scoreable=false: surface as an informational trust-signals panel with the adoption caveat stated in the UI, so users are not pushed to implement a standard with no proven consumer.

## Example failure

A regional news site publishes trust.txt with datatrainingallowed=no and belongto=https://example-press-association.org/. That association's trust.txt has no member= line for the site, so the membership claim is uncorroborated; meanwhile robots.txt has no GPTBot or ClaudeBot rules at all, so the site's only enforceable channel grants exactly the training access its declaration refuses.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
