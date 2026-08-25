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

## Implementation deviations

**Renamed** from `trust-txt-reciprocity-and-ai-policy-coherence`, which would
make a 63-character id; the shorter slug keeps both halves of the name.

Steps 1 to 4 and 6 of the sketch ship: both trust.txt locations, `name=value`
parsing with `#` comments, attribute-name validation against the spec set, the
reciprocity resolution for `belongto=` and `controlledby=`, the
`datatrainingallowed=` comparison against robots.txt AI-bot groups in both
directions, and the unscored informative tier with the adoption caveat stated
in the guidance.

**No code path returns `fail`**, and a test asserts it across every input.
The audit is `tier: 'informative'` at `weight: 0`, so a failure could not move
a score; rendering one would read as a defect the site must fix, and the
dossier's own honest limitation is that no consumer for this standard is
documented.

**At most three associations are resolved**, and the finding says how many
were skipped. Each is a GET of somebody else's host, and nothing else about
that host is read.

**The robots.txt comparison uses the shipped RFC 9309 parser** —
`parseRobots` and `isPathAllowed` from `gatherers/robots.ts` — so "does
robots.txt let GPTBot crawl" is answered the same way here as in the
`access-crawl-control` audits.

## Deferred

- **`social=` verification.** It needs the `trust://<domain>!` string fetched
  from a third-party social profile, which is a headless-browser roadmap item
  and a request to a host the scanner has no business fetching.
- **`vendor=`/`customer=` resolution.** The spec does not define those as
  reciprocal, so there is nothing to check them against.
- **Cross-scan caching of association documents.** The cache is per scan.
