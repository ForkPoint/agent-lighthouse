---
audit: agent-interfaces/mcp-discovery
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-discovery.ts
slug: mcp-discovery
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-24
recommended_tier: scored
tier_rationale: "Recommended scored for one signal; ships informative because four of the five researched signals record `Consumers: none-known` and recommend informative or delete (contradiction sweep, 2026-08-24)."
consumers:
  - all clients following RFC 8615 well-known conventions
signals:
  - name: mcp-discovery-ai-catalog-well-known
    grade: C
    domain: agent-action-surfaces
  - name: mcp-server-card-document
    grade: C
    domain: agent-action-surfaces
  - name: mcp-well-known-mcp-json
    grade: C
    domain: agent-action-surfaces
  - name: mcp-uri-scheme-and-dns-discovery
    grade: D
    domain: agent-action-surfaces
  - name: agent-surface-soft-404-validation
    grade: A
    domain: agent-action-surfaces
sources:
  - mcp-sep-2127
  - mcp-ext-server-card-discovery
  - ai-catalog-repo
  - iana-well-known-uris
  - mcp-spec-versioning
  - anthropic-claude-custom-connectors
  - openai-apps-sdk-deploy
  - probe-vercel-ai-catalog
  - probe-zapier-ai-catalog
  - mcp-sep-1649-server-cards
  - probe-zapier-server-card
  - probe-cloudflare-mcp-json
  - probe-notion-mcp-json
  - ietf-draft-serra-mcp-discovery-uri
  - apievangelist-api-catalog-adoption
  - rfc-9727
  - probe-vercel-api-catalog
  - probe-zapier-api-catalog
---

# mcp-discovery (`5.12`)

> agent-tools · source `mcp-discovery.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Whether the site publishes an MCP discovery document at `/.well-known/mcp/servers.json` or `/.well-known/ucp`, and whether what it publishes can be read.

| State                                                              | Result |
| :----------------------------------------------------------------- | :----- |
| a document that parses and lists at least one server or capability | `pass` |
| a document that does not parse, or that lists nothing              | `fail` |
| no document published                                              | `na`   |

Reported, not scored. Neither path is registered or specified, and no shipping MCP client is documented as fetching either, so a site with a working MCP server discovered by another route is not less agent-ready for publishing no such file. What an MCP server's actual reachability is checked by is `agent-interfaces/mcp-modern-era-reachability` and `mcp-oauth-discovery-chain`.

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and verified live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day it was checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is not merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is not in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it. Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server'. OpenAI's Apps SDK routes through a developer-mode URL paste, plus 'public plugin submission' with 'domain verification'. A probe of 19 major domains found only 2 publishers: Vercel and Zapier. SEP-2127 itself lists 'No Domain-Level Discovery' as an _unsolved_ pain point, which is an admission that the mechanism does not yet work.

### Signal: mcp-server-card-document — grade C (agent-action-surfaces)

**Mechanism:** An MCP Server Card is a JSON document carrying identity, remotes[], capabilities and auth. Serving it at the SEP-2127 recommended location, `<streamable-http-url>/server-card`, lets a client learn transport URLs, supported protocol versions and auth requirements before initialization. That removes a round trip, and enables registry crawling.

**Evidence:** SEP-2127 defines the card: 'Cards themselves can be hosted at any unreserved URI, with `<streamable-http-url>/server-card` reserved as the recommended location.' Fields: name, version, description, optional title/icons/repository/websiteUrl, remotes[] (URL, headers, variable templates, supportedProtocolVersions), auth, _meta. The SEP deliberately EXCLUDES tools/resources/prompts because 'MCP servers are inherently dynamic' and a static document 'cannot reliably represent this surface' — so a server card can never substitute for tools/list. Four production deployments verified live 2026-08-20 at the older SEP-1649 path /.well-known/mcp/server-card.json: zapier.com (name com.zapier/mcp, streamable-http remote, supportedProtocolVersions back to 2024-10-07, oauth2), sentry.io, intercom.com, webflow.com. Audit guidance: accept both `<mcp-url>/server-card` (current recommendation) and /.well-known/mcp/server-card.json (deployed legacy), validate name/version/remotes[].url/remotes[].type, and treat presence as a positive-only informative hint.

**Counter-evidence:** Two incompatible paths already exist in the wild because SEP-1649 (which used /.well-known/mcp/server-card.json) was CLOSED 2026-01-26 and replaced by SEP-2127 (which does not reserve that path) — every real deployment found uses the superseded path. SEP-2127 remains unmerged after ~7 months in review with 41 comments and 27 review comments. No MCP client is documented as fetching a server card. The card cannot advertise tools, so it does not tell an agent what the site can actually do.

### Signal: mcp-well-known-mcp-json — grade C (agent-action-surfaces)

**Mechanism:** Publishing /.well-known/mcp.json on a website causes MCP clients to auto-discover the site's MCP endpoint.

**Evidence:** This is the path most widely repeated in blog posts, and the one an audit tool is most likely to be asked for. It does have real adopters: a live check on 2026-08-20 found that cloudflare.com, notion.so and sentry.io all return HTTP 200 JSON at /.well-known/mcp.json. That is genuine partial adoption by serious engineering organisations, which is why this is C and not D.

**Counter-evidence:** There is no specification for this path at all. It is not in the ratified MCP spec (2026-07-28), it is not in SEP-2127 (which chose /.well-known/ai-catalog.json instead), it is not in the closed SEP-1649 (which chose /.well-known/mcp/server-card.json), and `mcp.json` is not in the IANA Well-Known URIs registry. Worse, the deployed documents are mutually INCOMPATIBLE: Cloudflare serves {"mcpServers":{"cloudflare_site":{...transport:{type,url}}}} (a Claude-desktop-config shape) while Notion serves a flat {"name","description","icon","endpoint"} object. A parser written for one fails on the other, so no client could consume the path generically even if it wanted to. Recommendation: audit for it as a positive-only informative hint, never as a scored requirement, and never prescribe a schema — point authors at /.well-known/ai-catalog.json instead. Also guard against soft-404s: sites like linear.app and github.com return HTTP 200 text/html for /mcp and /openapi.json, so content-type checking is mandatory.

### Signal: mcp-uri-scheme-and-dns-discovery — grade D (agent-action-surfaces)

**Mechanism:** Publishing an `_mcp.{host} IN TXT` DNS record and/or a document at /.well-known/mcp-server lets clients resolve mcp://{host} to a live MCP endpoint.

**Evidence:** draft-serra-mcp-discovery-uri-04 is a live IETF Internet-Draft (updated 2026-03-26, expires 2026-09-25) defining the mcp: URI scheme, a DNS TXT fast path, and a base mode where 'The client MUST perform an HTTP GET request to: https://{host}/.well-known/mcp-server'. It is technically coherent and would be the cleanest mechanism if adopted.

**Counter-evidence:** It is an individual submission with no IETF stream assignment and no working-group adoption; `mcp-server` is not in the IANA Well-Known URIs registry; the draft expires next month. Most decisively, it is CONTRADICTED by the upstream project: MCP's own SEP-2127 chose /.well-known/ai-catalog.json for domain-level discovery, so an audit that told authors to publish /.well-known/mcp-server would be steering them away from the path MCP is actually standardising. A probe found zero deployments. The rubric's mechanical rule would put a live Internet-Draft in 'experimental'; this dossier recommends delete instead, because the upstream conflict makes the advice actively misleading rather than merely unproven.

### Signal: agent-surface-soft-404-validation — grade A (agent-action-surfaces)

**Mechanism:** A well-known or conventional agent-discovery path that returns HTTP 200 with an HTML body is worse than a 404 — that body is an SPA catch-all rather than a real document. A conforming client follows the standard, fails to parse, and has no recourse. Any audit must therefore validate content-type and parseability, not status code.

**Evidence:** This is a meta-signal about how the other audits must be implemented, and it is the best-evidenced claim in the whole domain. The May 2026 API Evangelist study covered 74 providers. Of the roughly 72 that served no valid catalog, only two returned a clean 404; sixty-eight returned HTTP 200 with an HTML body. The study concluded: 'an agent following the standard would get a 200, try to parse a LinkSet out of the body, fail, and have no useful recourse — an HTML 200 at a well-known path lies, which is worse than a 404.' A probe on 2026-08-20 reproduced that result across a different path set. linear.app returned 200 text/html for /openapi.json; github.com, linear.app, vercel.com and zapier.com returned 200 text/html for /mcp; zapier.com returned 200 text/html for /.well-known/ai-plugin.json. A status-code-only scanner would have reported all of these as adoption. The correct rule is to require a JSON, YAML or linkset content-type, and to require the body to parse. Where a spec names a media type, prefer it: application/ai-catalog+json for AI catalogs, application/linkset+json with the RFC 9727 profile for api-catalog, and application/mcp-server-card+json for card entries. Vercel demonstrates that all of this is achievable in production.

**Counter-evidence:** None found — this is a validation-correctness requirement, not a contested adoption claim. The only nuance is that content negotiation is legitimate. RFC 9727 permits additional formats beyond the mandatory Linkset, so an audit should send an explicit Accept header before concluding a publisher is non-conformant. It should also not penalise a clean 404, which is honest, the way it penalises an HTML 200, which is a lie.

## Implementation deviations

- The audit ships grade C, `informative`, weight 0. Four of its five signals record no known consumer.
- The grade-A soft-404 signal is not split into its own audit. `agent-interfaces/openapi-exists` already applies it at `/.well-known/api-catalog`. At these paths no client exists to be misled.
- Absence of both documents is `notApplicable`.
- `{"servers": []}` fails. A UCP document with neither services nor capabilities fails.
- The audit does not probe `/mcp`, `/api/mcp` or `/sse`. `mcp-modern-era-reachability` and `mcp-oauth-discovery-chain` own those mechanisms.
