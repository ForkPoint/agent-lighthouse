---
audit: agent-tools/mcp-discovery
audit_id: "5.12"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/mcp-discovery.ts
slug: mcp-discovery
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# mcp-discovery (`5.12`)

> agent-tools · source `mcp-discovery.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

MCP (Model Context Protocol) lets AI assistants like Claude and ChatGPT directly integrate your site as a tool. Publishing an MCP discovery file means users can add your site as a tool in their AI assistant with a single URL, enabling rich interactions beyond simple browsing.

## Code review findings (2026-08-20, 11-agent pass)

MCP is the one protocol in this category that genuinely matters in 2026, but the audit looks for it at a path that is not standardized, and its fallback branch passes on any JSON at /.well-known/ucp with zero validation. So it produces false failures for sites that really do run MCP servers and vacuous passes for sites that publish an unrelated file.

**Required fix:** Detect MCP the way clients actually do: probe a small set of conventional endpoints (/mcp, /api/mcp, /sse) with a real initialize handshake, honor `/.well-known/oauth-protected-resource` (the one well-known path MCP genuinely defines for authorization discovery), and accept a `<link rel="mcp-server">`-style hint if the project wants one. Keep servers.json only as a secondary hint. Require the UCP branch to validate a `services` or `capabilities` object with at least one entry before passing, and reject empty `servers` arrays. Return `notApplicable` rather than `fail` for sites with no API surface at all.

**False-positive risks:**
- `/.well-known/mcp/servers.json` is not a registered or spec'd MCP discovery path. Sites that genuinely expose an MCP server — at /mcp, /api/mcp, /sse, advertised via the MCP registry, via `/.well-known/oauth-protected-resource`, or via a `mcp.json` config — all report 'MCP server discovery file not found' at medium priority. This is a false FAIL on precisely the sites that are most agent-ready.
- The UCP fallback (lines 93-107) passes on ANY parseable JSON object at /.well-known/ucp: `if (isObject(ucpParsed))` → immediate `this.pass(...)`. No `services`, no `capabilities`, no version required — `{}` at that path yields 'UCP/MCP discovery profile found with 0 services and 0 capabilities' as a PASS. Vacuous pass with a confident message.
- `ucpParsed['services'] || ucpObj['services']` uses `||` so a legitimately empty object/array falls through to the other source; combined with the no-validation pass this makes the reported counts arbitrary.
- Success path only checks `Array.isArray(parsed['servers'])` — `{"servers": []}` passes as 'found with 0 server(s)'.
- WAF 403 on /.well-known/* → 'not found'.

**Test gaps:**
- No test that `{}` at /.well-known/ucp produces a vacuous pass (it does)
- No test for `{"servers": []}` being a vacuous pass
- No fixture for a site whose MCP server is discoverable by any other means (registry entry, /mcp probe, oauth-protected-resource)
- No WAF/403 fixture

**Overlaps with:** `5.13`, `5.14`

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an *unsolved* pain point, which is an admission that the mechanism does not yet work.
**Consumers:** none-known (no shipping MCP client documents fetching this path) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Agent-Card/ai-catalog — working repository for common AI Card standard](https://github.com/Agent-Card/ai-catalog) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [Third party connectors with remote MCP — Claude Docs](https://claude.com/docs/connectors/custom/remote-mcp) · [OpenAI Apps SDK — Deploy](https://developers.openai.com/apps-sdk/deploy/) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

### Signal: mcp-server-card-document — grade C (agent-action-surfaces)

**Mechanism:** Serving an MCP Server Card JSON document (identity + remotes[] + capabilities + auth) at the SEP-2127 recommended location `<streamable-http-url>/server-card` lets a client learn transport URLs, supported protocol versions and auth requirements before initialization, removing a round trip and enabling registry crawling.

**Evidence:** SEP-2127 defines the card: 'Cards themselves can be hosted at any unreserved URI, with `<streamable-http-url>/server-card` reserved as the recommended location.' Fields: name, version, description, optional title/icons/repository/websiteUrl, remotes[] (URL, headers, variable templates, supportedProtocolVersions), auth, _meta. The SEP deliberately EXCLUDES tools/resources/prompts because 'MCP servers are inherently dynamic' and a static document 'cannot reliably represent this surface' — so a server card can never substitute for tools/list. Four production deployments verified live 2026-08-20 at the older SEP-1649 path /.well-known/mcp/server-card.json: zapier.com (name com.zapier/mcp, streamable-http remote, supportedProtocolVersions back to 2024-10-07, oauth2), sentry.io, intercom.com, webflow.com. Audit guidance: accept BOTH `<mcp-url>/server-card` (current recommendation) and /.well-known/mcp/server-card.json (deployed legacy), validate name/version/remotes[].url/remotes[].type, and treat presence as a positive-only informative hint.

**Counter-evidence:** Two incompatible paths already exist in the wild because SEP-1649 (which used /.well-known/mcp/server-card.json) was CLOSED 2026-01-26 and replaced by SEP-2127 (which does not reserve that path) — every real deployment I found uses the superseded path. SEP-2127 remains unmerged after ~7 months in review with 41 comments and 27 review comments. No MCP client is documented as fetching a server card. The card cannot advertise tools, so it does not tell an agent what the site can actually do.
**Consumers:** none-known (no client documents fetching server cards; registries could but none document it) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [SEP-1649: MCP Server Cards — HTTP Server Discovery via .well-known (superseded issue)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Zapier /.well-known/mcp/server-card.json](https://zapier.com/.well-known/mcp/server-card.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

### Signal: mcp-well-known-mcp-json — grade C (agent-action-surfaces)

**Mechanism:** Publishing /.well-known/mcp.json on a website causes MCP clients to auto-discover the site's MCP endpoint.

**Evidence:** This is the path most widely repeated in blog posts and the one an audit tool is most likely to be asked for, and it does have real adopters — I verified live on 2026-08-20 that cloudflare.com, notion.so and sentry.io all return HTTP 200 JSON at /.well-known/mcp.json. That is genuine partial adoption by serious engineering organisations, which is why this is C and not D.

**Counter-evidence:** There is no specification for this path at all. It is not in the ratified MCP spec (2026-07-28), it is not in SEP-2127 (which chose /.well-known/ai-catalog.json instead), it is not in the closed SEP-1649 (which chose /.well-known/mcp/server-card.json), and `mcp.json` is not in the IANA Well-Known URIs registry. Worse, the deployed documents are mutually INCOMPATIBLE: Cloudflare serves {"mcpServers":{"cloudflare_site":{...transport:{type,url}}}} (a Claude-desktop-config shape) while Notion serves a flat {"name","description","icon","endpoint"} object. A parser written for one fails on the other, so no client could consume the path generically even if it wanted to. Recommendation: audit for it as a positive-only informative hint, never as a scored requirement, and never prescribe a schema — point authors at /.well-known/ai-catalog.json instead. Also guard against soft-404s: sites like linear.app and github.com return HTTP 200 text/html for /mcp and /openapi.json, so content-type checking is mandatory.
**Consumers:** none-known · **Recommended tier:** informative

**Sources:** [Live deployment: Cloudflare /.well-known/mcp.json](https://cloudflare.com/.well-known/mcp.json) · [Live deployment: Notion /.well-known/mcp.json](https://notion.so/.well-known/mcp.json) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [SEP-1649: MCP Server Cards — HTTP Server Discovery via .well-known (superseded issue)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649)

### Signal: mcp-uri-scheme-and-dns-discovery — grade D (agent-action-surfaces)

**Mechanism:** Publishing an `_mcp.{host} IN TXT` DNS record and/or a document at /.well-known/mcp-server lets clients resolve mcp://{host} to a live MCP endpoint.

**Evidence:** draft-serra-mcp-discovery-uri-04 is a live IETF Internet-Draft (updated 2026-03-26, expires 2026-09-25) defining the mcp: URI scheme, a DNS TXT fast path, and a base mode where 'The client MUST perform an HTTP GET request to: https://{host}/.well-known/mcp-server'. It is technically coherent and would be the cleanest mechanism if adopted.

**Counter-evidence:** It is an individual submission with no IETF stream assignment and no working-group adoption; `mcp-server` is not in the IANA Well-Known URIs registry; the draft expires next month. Most decisively, it is CONTRADICTED by the upstream project: MCP's own SEP-2127 chose /.well-known/ai-catalog.json for domain-level discovery, so an audit that told authors to publish /.well-known/mcp-server would be steering them away from the path MCP is actually standardising. Zero deployments found in my probe. (The rubric's mechanical rule would put a live I-D in 'experimental'; I am recommending delete instead because the upstream conflict makes this actively misleading advice, not merely unproven.)
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [draft-serra-mcp-discovery-uri-04 — The "mcp" URI Scheme and MCP Server Discovery Mechanism](https://datatracker.ietf.org/doc/draft-serra-mcp-discovery-uri/) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md)

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body (an SPA catch-all rather than a real document) is worse than a 404, because a conforming client follows the standard, fails to parse, and has no recourse — so any audit must validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study of 74 providers found that of the ~72 that did not serve a valid catalog, only TWO returned a clean 404 while SIXTY-EIGHT returned HTTP 200 with an HTML body, and concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' My own probe on 2026-08-20 reproduced this independently across a different path set: linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. Correct rule: require a JSON/YAML/linkset content-type, require the body to parse, and where a spec names a media type prefer it (application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, application/mcp-server-card+json for card entries) — Vercel demonstrates all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate: RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant, and should not penalise a clean 404 (which is honest) the way it penalises an HTML 200 (which is a lie).
**Consumers:** all clients following RFC 8615 well-known conventions · **Recommended tier:** scored

**Sources:** [Only Four API Providers Publish a Real .well-known/api-catalog Right Now](https://apievangelist.com/blog/2026/05/22/four-providers-publishing-well-known-api-catalog/) · [RFC 9727 — api-catalog: A Well-Known URI and Link Relation to Help Discovery of APIs](https://www.rfc-editor.org/rfc/rfc9727.html) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Live deployment: Vercel /.well-known/api-catalog (RFC 9727)](https://vercel.com/.well-known/api-catalog) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/api-catalog](https://zapier.com/.well-known/api-catalog)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
