---
audit: agent-interfaces/mcp-endpoint
audit_id: "5.13"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-endpoint.ts
slug: mcp-endpoint
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# mcp-endpoint (`5.13`)

> agent-tools · source `mcp-endpoint.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Your MCP server must respond to JSON-RPC 2.0 initialize requests for AI assistants to connect. If the endpoint is down or misconfigured, agents cannot use your MCP tools. Verify the server is running and accepts POST requests with Content-Type: application/json.

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

**Overlaps with:** `5.12`, `5.14`

## Evidence

### Signal: nlweb-endpoint — grade C (agent-action-surfaces)

**Mechanism:** Deploying an NLWeb instance (exposing /ask and an MCP endpoint over the site's existing schema.org/RSS data) makes the site's content queryable in natural language by agents.

**Evidence:** NLWeb is a real, still-active project with unusually credible named adopters. Microsoft's launch announcement (2025-05-19, Build 2025) states 'Every NLWeb instance is also a Model Context Protocol (MCP) server, allowing websites to make their content discoverable and accessible to agents' and that it 'leverages semi-structured formats like Schema.org, RSS and other data that websites already publish.' Named early adopters: Shopify, Snowflake, Tripadvisor, Eventbrite, O'Reilly Media, Hearst (Delish), Chicago Public Media, Common Sense Media, DDM (Allrecipes/Serious Eats), Milvus, Qdrant, Inception Labs. The reference implementation has 6,249 stars and was pushed 2026-08-11, with satellite projects (nlweb-net, MSR-Web-Verbs, crawler) — so it is alive, and its schema.org dependency makes it a natural companion to structured-data audits.

**Counter-evidence:** Governance has drifted: the canonical repo is no longer microsoft/NLWeb — api.github.com/repos/microsoft/NLWeb returns HTTP 301 redirecting to the nlweb-ai org — so it is no longer a Microsoft-org project even though support still routes to NLWebSup@microsoft.com. Critically for an audit, there is NO discovery mechanism: `nlweb` is not in the IANA Well-Known URIs registry, the README defines no .well-known path, and endpoint paths (/ask, /mcp) are deployment choices, so a scanner cannot reliably detect an NLWeb deployment without guessing. Probing /mcp is actively unreliable — github.com, linear.app, vercel.com and zapier.com all return HTTP 200 text/html at /mcp (marketing pages, not endpoints). Wikipedia's entry is a stub with no adoption figures, and no independent dataset measures NLWeb deployment. Treat as informative and detect only via an explicitly declared endpoint (e.g. an ai-catalog entry), never by path guessing.
**Consumers:** MCP clients pointed at the instance's endpoint, NLWeb-aware clients · **Recommended tier:** informative

**Sources:** [Introducing NLWeb: Bringing conversational interfaces directly to the web](https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web/) · [nlweb-ai/NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Live deployment: Cloudflare /.well-known/mcp.json](https://cloudflare.com/.well-known/mcp.json)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
