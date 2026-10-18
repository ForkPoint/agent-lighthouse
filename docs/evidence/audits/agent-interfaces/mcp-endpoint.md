---
audit: agent-interfaces/mcp-endpoint
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-endpoint.ts
slug: mcp-endpoint
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs mcp-capabilities (5.14) and webmcp-tool-annotations (5.24)"
reviewed: 2026-08-22
recommended_tier: informative
consumers:
  - "MCP clients pointed at the instance's endpoint"
  - NLWeb-aware clients
signals:
  - name: nlweb-endpoint
    grade: C
    domain: agent-action-surfaces
sources:
  - microsoft-nlweb-announcement
  - nlweb-repo-howto
  - iana-well-known-uris
  - probe-cloudflare-mcp-json
  - mcp-ext-server-card-discovery
---

# mcp-endpoint (`5.13`, `5.14`, `5.24`)

> agent-interfaces · source `mcp-endpoint.ts` · merged MCP endpoint audit, absorbs mcp-capabilities (5.14) and webmcp-tool-annotations (5.24) · evidence grade **C** · tier **informative** (weight 0)

## What it checks

One MCP endpoint audit, over one connection: find the endpoint the site _declares_, speak a spec-compliant `initialize` handshake to it, read the capabilities the server negotiates on the wire, and read the annotations off the tools it actually lists.

| State                                                                                                                                                          | Result                  |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- |
| valid JSON-RPC `initialize` result, at least one negotiated capability, and — when `tools` is negotiated — every listed tool carrying a boolean `readOnlyHint` | `pass`                  |
| HTTP 401 with a `WWW-Authenticate` challenge — a correctly protected server, not a broken one                                                                  | `pass` (with note)      |
| valid handshake but no negotiated capability, or some listed tools missing a boolean `readOnlyHint`, or HTTP 200 whose body is not JSON-RPC                    | `warn`, priority `high` |
| malformed `servers.json`, an unreadable Server Card or one with no `remotes[].url`, an endpoint that is not safe to probe, another non-200, or unreachable     | `fail`, priority `high` |
| no endpoint declared anywhere                                                                                                                                  | `notApplicable`         |

`tools/list` is only called when the server negotiates the `tools` capability, and a `tools/list` that does not answer is reported, never punished.

## Evidence

### Signal: nlweb-endpoint — grade C (agent-action-surfaces)

**Mechanism:** Deploying an NLWeb instance (exposing /ask and an MCP endpoint over the site's existing schema.org/RSS data) makes the site's content queryable in natural language by agents.

**Evidence:** NLWeb is a real, still-active project with unusually credible named adopters. Microsoft's launch announcement (2025-05-19, Build 2025) states that 'Every NLWeb instance is also a Model Context Protocol (MCP) server, allowing websites to make their content discoverable and accessible to agents'. It adds that NLWeb 'leverages semi-structured formats like Schema.org, RSS and other data that websites already publish.' The named early adopters are Shopify, Snowflake, Tripadvisor, Eventbrite, O'Reilly Media, Hearst (Delish), Chicago Public Media, Common Sense Media, DDM (Allrecipes/Serious Eats), Milvus, Qdrant and Inception Labs. The reference implementation has 6,249 stars and was pushed 2026-08-11, with satellite projects (nlweb-net, MSR-Web-Verbs, crawler) — so it is alive, and its schema.org dependency makes it a natural companion to structured-data audits.

**Counter-evidence:** Governance has drifted: the canonical repo is no longer microsoft/NLWeb — api.github.com/repos/microsoft/NLWeb returns HTTP 301 redirecting to the nlweb-ai org — so it is no longer a Microsoft-org project even though support still routes to NLWebSup@microsoft.com. Critically for an audit, there is no discovery mechanism. `nlweb` is not in the IANA Well-Known URIs registry, and the README defines no .well-known path. Endpoint paths such as /ask and /mcp are deployment choices. A scanner cannot reliably detect an NLWeb deployment without guessing. Probing /mcp is actively unreliable — github.com, linear.app, vercel.com and zapier.com all return HTTP 200 text/html at /mcp (marketing pages, not endpoints). Wikipedia's entry is a stub with no adoption figures, and no independent dataset measures NLWeb deployment. Treat as informative and detect only via an explicitly declared endpoint (e.g. an ai-catalog entry), never by path guessing.

## Implementation deviations

- The audit absorbs mcp-capabilities (5.14) and webmcp-tool-annotations (5.24). Their records are in `docs/evidence/merged/agent-interfaces/`.
- `/mcp`, `/api/mcp` and `/sse` are not probed. The NLWeb evidence says to detect only a declared endpoint, never by path guessing.
- Declared endpoints come from `servers.json`, the UCP service list, and an `application/mcp-server-card+json` entry in the ARD catalog at `/.well-known/ard.json` or `/.well-known/ai-catalog.json`.
- A catalog entry's `url` addresses the Server Card, not the endpoint ([discovery.md](https://github.com/modelcontextprotocol/experimental-ext-server-card/blob/main/docs/discovery.md), verified 2026-10-18). `gatherers/mcp.ts` reads the card and returns its `remotes[].url`, preferring a `streamable-http` remote. A card that cannot be read, or that names no remote, is a broken declaration and fails. Until 2026-10-18 the audit POSTed `initialize` to the card URL, which failed sites that published a correct catalog.
- Both catalogs are searched for the Server Card entry, `ard.json` first. A site may list other artifacts in `ard.json` and the card in `ai-catalog.json`, the path the Server Card extension names. A relative card `url` resolves against its catalog, and a relative `remotes[].url` against the card, because the spec says only that these SHOULD be absolute.
- An entry that embeds its Server Card inline (`data` instead of `url`) is not read yet, and counts as no declaration.
- No declared endpoint returns `notApplicable` (absent artifact, absent verdict). Until 2026-10-18 it returned `fail` at high priority on every site without an MCP server.
- The request sends `Accept: application/json, text/event-stream`, and SSE frames are unwrapped.
- 401 with a `WWW-Authenticate` challenge passes with a note. A bare 401 fails.
- The POST is gated by `isSafeUrl()`.
- Capabilities come from `result.capabilities` of the live handshake. A `null`, `0` or `""` value does not count.
- `Mcp-Session-Id` is not handled. A server that requires a session may answer 400.
- `server/discover` is not used. `initialize` is the interoperable path across the deployed base.
- Only a boolean `readOnlyHint` is required on each tool. `untrustedContentHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` are not scored.
