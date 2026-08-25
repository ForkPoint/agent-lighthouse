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
---

# mcp-endpoint (`5.13`, `5.14`, `5.24`)

> agent-interfaces · source `mcp-endpoint.ts` · merged MCP endpoint audit, absorbs mcp-capabilities (5.14) and webmcp-tool-annotations (5.24) · evidence grade **C** · tier **informative** (weight 0)

## What it checks

One MCP endpoint audit, over one connection: find the endpoint the site *declares*, speak a spec-compliant `initialize` handshake to it, read the capabilities the server negotiates on the wire, and read the annotations off the tools it actually lists.

| State | Result |
| :--- | :--- |
| valid JSON-RPC `initialize` result, at least one negotiated capability, and — when `tools` is negotiated — every listed tool carrying a boolean `readOnlyHint` | `pass` |
| HTTP 401 with a `WWW-Authenticate` challenge — a correctly protected server, not a broken one | `pass` (with note) |
| valid handshake but no negotiated capability, or some listed tools missing a boolean `readOnlyHint`, or HTTP 200 whose body is not JSON-RPC | `warn`, priority `high` |
| no endpoint declared anywhere, malformed `servers.json`, an endpoint that is not safe to probe, another non-200, or unreachable | `fail`, priority `high` |

`tools/list` is only called when the server negotiates the `tools` capability, and a `tools/list` that does not answer is reported, never punished.

## Code review findings (2026-08-20, 11-agent pass)

The most valuable audit in the category in principle — it actually speaks the protocol — but the handshake it sends is not spec-compliant, so a correctly implemented Streamable HTTP MCP server answers it with 406 or an SSE body and gets reported as broken. This is the clearest case of the framework producing a false negative against a site that is doing everything right.

**Required fix:** Send a spec-compliant handshake: `acceptHeader: 'application/json, text/event-stream'`, a current `protocolVersion`, and handle `Mcp-Session-Id`. Parse SSE-framed responses by extracting the `data:` payload before JSON.parse. Treat 401 with `WWW-Authenticate` as PASS-with-note ('server present, authorization required') rather than fail. Discover the endpoint independently of servers.json (probe /mcp, /api/mcp, /sse). Gate the POST behind `isSafeUrl()` from fetcher.ts.

**False-positive risks:**
- The request omits the required Accept header. MCP Streamable HTTP requires the client to send `Accept: application/json, text/event-stream`; the official TypeScript SDK's StreamableHTTPServerTransport rejects requests lacking both with 406 Not Acceptable. `ctx.fetch({url, method:'POST', body, contentType:'application/json'})` never sets `acceptHeader`, so fetcher.ts defaults to `*/*` → 406 → `this.fail('MCP endpoint ... returned HTTP 406')` against a perfectly healthy server.
- Even on success, a Streamable HTTP server may reply with `Content-Type: text/event-stream` and a framed body (`event: message\ndata: {...}`). `tryParseJson(response.body)` fails on the SSE framing → `warn('returned HTTP 200 but response is not valid JSON-RPC')` for a valid response. The SSE frame is never unwrapped.
- OAuth-protected MCP servers (the norm for anything non-public in 2026) answer an unauthenticated initialize with 401 + `WWW-Authenticate`. That is correct, secure behavior, reported here as a hard FAIL at high priority.
- `Mcp-Session-Id` handling is absent; servers requiring session initialization semantics may 400.
- `protocolVersion: '2024-11-05'` is hardcoded and stale; servers that reject unsupported protocol versions return a JSON-RPC error → the `!('error' in respBody)` guard turns it into a warn.
- Endpoint discovery is entirely dependent on the non-standard servers.json from 5.12, so a real MCP server is usually never probed at all — 'No MCP servers.json found' is a fail about a missing file, dressed up as a fail about a broken endpoint.
- POSTing a JSON-RPC body to a URL harvested from a site-controlled file is an SSRF-adjacent operation; `isSafeUrl()` exists in fetcher.ts:84 and is not called here.

**Test gaps:**
- No test asserting the request carries `Accept: application/json, text/event-stream` — the defect that makes this audit fail real servers
- No SSE-framed (`text/event-stream`) response fixture
- No 401 + WWW-Authenticate (OAuth-protected server) fixture
- No 406 fixture
- No test that the harvested URL is validated with isSafeUrl before POSTing
- No session-id / protocol-version-negotiation fixture

**Overlaps with:** `5.12`, `5.14` (now absorbed here), `5.24` (now absorbed here)

## Evidence

### Signal: nlweb-endpoint — grade C (agent-action-surfaces)

**Mechanism:** Deploying an NLWeb instance (exposing /ask and an MCP endpoint over the site's existing schema.org/RSS data) makes the site's content queryable in natural language by agents.

**Evidence:** NLWeb is a real, still-active project with unusually credible named adopters. Microsoft's launch announcement (2025-05-19, Build 2025) states that 'Every NLWeb instance is also a Model Context Protocol (MCP) server, allowing websites to make their content discoverable and accessible to agents'. It adds that NLWeb 'leverages semi-structured formats like Schema.org, RSS and other data that websites already publish.' The named early adopters are Shopify, Snowflake, Tripadvisor, Eventbrite, O'Reilly Media, Hearst (Delish), Chicago Public Media, Common Sense Media, DDM (Allrecipes/Serious Eats), Milvus, Qdrant and Inception Labs. The reference implementation has 6,249 stars and was pushed 2026-08-11, with satellite projects (nlweb-net, MSR-Web-Verbs, crawler) — so it is alive, and its schema.org dependency makes it a natural companion to structured-data audits.

**Counter-evidence:** Governance has drifted: the canonical repo is no longer microsoft/NLWeb — api.github.com/repos/microsoft/NLWeb returns HTTP 301 redirecting to the nlweb-ai org — so it is no longer a Microsoft-org project even though support still routes to NLWebSup@microsoft.com. Critically for an audit, there is no discovery mechanism. `nlweb` is not in the IANA Well-Known URIs registry, and the README defines no .well-known path. Endpoint paths such as /ask and /mcp are deployment choices. A scanner cannot reliably detect an NLWeb deployment without guessing. Probing /mcp is actively unreliable — github.com, linear.app, vercel.com and zapier.com all return HTTP 200 text/html at /mcp (marketing pages, not endpoints). Wikipedia's entry is a stub with no adoption figures, and no independent dataset measures NLWeb deployment. Treat as informative and detect only via an explicitly declared endpoint (e.g. an ai-catalog entry), never by path guessing.

## The merge (Plan 4, Task 7, 2026-08-22)

5.14 and 5.24 both asked good questions about the wrong artifact, and both required fixes named the same destination: *"Merge into 5.13 (mcp-endpoint): have the initialize handshake return its `result.capabilities` and report tools/resources/prompts from the wire response"* (5.14), and *"Merge into the MCP endpoint work (5.13): after a successful initialize, call `tools/list` and evaluate the real `annotations` block on each returned tool, requiring boolean values and requiring at least `readOnlyHint` on every tool"* (5.24). Both are executed here, on the connection 5.13 already opens.

**The handshake is now spec-compliant**, which is the fix that matters most: 5.13 was the framework's clearest false negative against a site doing everything right.

- **`Accept: application/json, text/event-stream`** is sent. Streamable HTTP requires both, and the official TypeScript SDK's `StreamableHTTPServerTransport` answers 406 without them — so a healthy server was reported as `HTTP 406`.
- **SSE frames are unwrapped.** A Streamable HTTP server may answer with `text/event-stream` and an `event: message\ndata: {…}` body; `JSON.parse` on the raw frame produced *"HTTP 200 but response is not valid JSON-RPC"* for a valid response.
- **`protocolVersion` is current** (`2026-07-28`, the current specification revision) instead of the hardcoded, stale `2024-11-05` that version-strict servers answer with a JSON-RPC error.
- **401 + `WWW-Authenticate` is a pass with a note.** OAuth-protected servers — the norm for anything non-public in 2026 — answer an unauthenticated `initialize` exactly that way. That is correct, secure behaviour, previously reported as a hard `fail` at `high` priority. A bare 401 with no challenge still fails.
- **The POST is gated behind `isSafeUrl()`.** The target URL comes out of a site-controlled file and we send it a request body; that is SSRF-adjacent, and `fetcher.ts` already ships the guard.

### Absorbed evidence — mcp-capabilities (5.14)

5.14's dossier is kept verbatim at [merged/agent-interfaces/mcp-capabilities.md](../../merged/agent-interfaces/mcp-capabilities.md) (grade **D**). Its grading is unusually blunt about why the merge is the only sane outcome: *"The question this audit asks is legitimate and answerable at grade A, but only from the `server/discover` (or legacy `initialize`) response that 5.13 already fetches and discards."* No MCP specification version, registry document or vendor page defines `/.well-known/mcp/servers.json` or any per-origin capability manifest — the current spec puts capabilities in `server/discover`, legacy revisions in the `initialize` response, and third-party discovery runs through the MCP Registry.

So capabilities are now read from `result.capabilities` of the live handshake. Two of 5.14's implementation defects die with the static file: a value of `null`, `0` or `""` no longer counts as a declared capability (`server[key] !== undefined && server[key] !== false` let all three through), and the UCP fallback that passed on *any* non-empty key set under `capabilities` is gone. The `expected` string also stops lying — it promised "servers.json **or MCP response**" while no MCP response was ever consulted.

### Absorbed evidence — webmcp-tool-annotations (5.24)

5.24's dossier is kept verbatim at [merged/agent-interfaces/webmcp-tool-annotations.md](../../merged/agent-interfaces/webmcp-tool-annotations.md) (grade **D**). The annotation *concept* is real and normative — `readOnlyHint` is in WebMCP's `ToolAnnotations` IDL and in MCP's `tools/list` — but neither place 5.24 read it from exists in any specification: there is no `/.well-known/webmcp` manifest anywhere in the WebMCP repository, and the declarative explainer proposes `toolname`/`tooldescription`/`toolautosubmit`/`toolparamdescription` and no annotation attributes at all. The audit synthesised `data-read-only-hint`-style attributes, and its own `guidance.code` documented `data-readonly`, which the implementation did not even look for.

The signal now comes off a live `tools/list` response, and the check is the one 5.24's fix specifies: **a boolean `readOnlyHint` on every tool**. Presence-only matching counted `{"readOnlyHint": null}` as annotated, and any one of four annotations marked a tool fully annotated — so `destructiveHint: false` alone passed an audit that exists to flag destructive actions.

### Grade decision: stays **C**, tier `informative`, weight 0

5.13 grades **C** on the NLWeb endpoint signal — a real project with credible named adopters (Shopify, Snowflake, Tripadvisor, O'Reilly), where every NLWeb instance is also an MCP server — capped because there is no discovery mechanism at all: `nlweb` is not in the IANA well-known registry and endpoint paths are deployment choices. Both absorbed audits grade **D**, and neither brings a proven consumer: the artifacts they read are undefined in every spec. The strongest proven path is unchanged, so the grade stays **C**, `tier: informative`, `weightForGrade('C', 'informative')` = **0**.

`scoreDisplayMode` stays `informative` (the ledger law requires it for a non-`scored` tier). `defaultPriority` stays `high`. Net effect: three audits that failed together on one missing non-standard file — 5.14's dossier calls it a "third consecutive zero for one missing non-standard file … tripling the score impact of a single absence" — become one.

### Deviations

- **`/mcp`, `/api/mcp` and `/sse` are still not probed**, contrary to 5.13's required fix, because 5.13's own graded evidence contradicts that fix: *"Probing /mcp is actively unreliable — github.com, linear.app, vercel.com and zapier.com all return HTTP 200 text/html at /mcp (marketing pages, not endpoints) … detect only via an explicitly declared endpoint (e.g. an ai-catalog entry), never by path guessing."* Discovery follows that instruction instead: `servers.json`, the UCP service list, and — new here — an `application/mcp-server-card+json` entry in `/.well-known/ai-catalog.json`, which is the explicit declaration the evidence names. The "no endpoint" failure message now says what it means (no endpoint is *declared*) rather than dressing up a missing file as a broken endpoint.
- **`Mcp-Session-Id` is not handled.** `FetchOptions` exposes no arbitrary request headers and reads none back beyond `FetchResult.headers`, so session-initialisation semantics would need a fetcher change. Servers that require a session may still answer 400.
- **`server/discover` is not used.** The current spec makes it mandatory for servers, but `initialize` remains the interoperable path across the deployed base, and it is the call this audit already made.
- **`untrustedContentHint` is not required.** It is the other half of WebMCP's `ToolAnnotations`, but 5.24's fix names `readOnlyHint` as the requirement, and MCP itself warns that annotations from untrusted servers must not be relied on — so this reports declaration hygiene, not a safety guarantee.
- **`destructiveHint`, `idempotentHint` and `openWorldHint` are no longer scored.** Three of the four annotations 5.24 counted are MCP-only and absent from WebMCP's dictionary; requiring them would penalise a spec-conformant WebMCP tool.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 5.14 and 5.24 merge away into 5.13 (§5).
- 2026-08-22 — merged (Plan 4, Task 7); registry 157 → 155 for this fold.
