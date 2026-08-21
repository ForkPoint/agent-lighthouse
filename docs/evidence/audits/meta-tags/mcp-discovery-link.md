---
audit: meta-tags/mcp-discovery-link
audit_id: "4.17"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/mcp-discovery-link.ts
slug: mcp-discovery-link
review_verdict: delete
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# mcp-discovery-link (`4.17`)

> meta-tags · source `mcp-discovery-link.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

The MCP (Model Context Protocol) discovery link in <head> enables AI agents like Claude and ChatGPT to find and connect to your site's tool endpoints. This is how agents discover that your site offers programmatic actions (search, booking, data queries) beyond static content. Without it, agents cannot discover your MCP server.

## Code review findings (2026-08-20, 11-agent pass)

Right protocol, invented mechanism. A site running a fully functional, correctly advertised MCP server fails this audit, because it advertises through the well-known path rather than an HTML head link that no MCP client parses. The failure text — 'agents cannot discover your MCP server' — is therefore wrong in exactly the case that matters. Since the check is also HTML-only, it cannot see MCP endpoints on API-only origins at all.

**Required fix:** Delete from meta-tags. The valid version of this check is a well-known-URI probe (/.well-known/ MCP metadata, endpoint reachability, capability negotiation), which belongs with the other agent-tool audits, not among head meta tags. If the maintainer wants a head-link hint retained, it must be informational-only and must not fail sites that advertise MCP through the specified channels; the current 'agents cannot discover your MCP server' text must be removed either way.

**False-positive risks:**
- Correctly configured MCP servers fail: the matcher accepts only `rel="alternate" + type="application/json" + title~'mcp'`, `rel="mcp-discovery"`, or `rel="alternate"` with `href` containing `mcp.json`. None of these is the specified discovery mechanism, so a site advertising MCP through /.well-known/ is told agents cannot find it.
- `(l.title ?? '').toLowerCase().includes('mcp')` makes the optional, human-language `title` attribute load-bearing — a non-English title fails.
- The href branch `(l.href ?? '').toLowerCase().includes('mcp.json')` is a substring test: `href="/docs/not-really-mcp.json.html"` matches, and it also matches any path containing that string incidentally — a false pass.
- `l.rel === 'alternate'` and `l.rel === 'mcp-discovery'` are exact, case-sensitive comparisons; `rel="MCP-Discovery"` fails.
- `type === 'application/json'` rejects `application/json; charset=utf-8`.
- Only `ctx.pages[0]` is examined, so a docs site that links its MCP manifest from the developer section rather than the marketing homepage fails.
- API-only origins with no HTML at all cannot be evaluated by an HTML-head audit, yet are exactly the systems most likely to expose MCP.
- Every site without this invented tag — i.e. essentially all of them — takes a scored failure, adding fixed noise to the category.

**Test gaps:**
- No /.well-known/ MCP discovery test — the actual specified mechanism is never exercised, which is how the invented contract went unchallenged.
- No test of the `href.includes('mcp.json')` substring branch, including its false-positive form.
- No uppercase `rel="MCP-Discovery"` test.
- No charset-parameter MIME test.
- No title-less link test.
- Only 3 tests.

**Overlaps with:** `4.18`, `4.19`

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an *unsolved* pain point, which is an admission that the mechanism does not yet work.
**Consumers:** none-known (no shipping MCP client documents fetching this path) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Agent-Card/ai-catalog — working repository for common AI Card standard](https://github.com/Agent-Card/ai-catalog) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [Third party connectors with remote MCP — Claude Docs](https://claude.com/docs/connectors/custom/remote-mcp) · [OpenAI Apps SDK — Deploy](https://developers.openai.com/apps-sdk/deploy/) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

### Signal: mcp-discovery-link-relation-in-html — grade D (agent-action-surfaces)

**Mechanism:** Adding <link rel="mcp" href="..."> or an equivalent <meta> tag to a page's <head> causes an AI agent or crawler to discover the site's MCP server.

**Evidence:** No evidence of any kind was found supporting this. It appears to be an SEO-analogy invention rather than a real mechanism.

**Counter-evidence:** Decisive negatives on three axes. (1) IANA: the Link Relation Types registry contains no `mcp`, `mcp-server`, `agent`, or `webmcp` relation — an unregistered rel value has no defined semantics. (2) Specs: I read the full SEP-2127 diff (424 lines) and it contains no link relation and no HTML-level discovery whatsoever; the extension's docs/discovery.md defines only the well-known URI and catalog entries; the ratified MCP spec's only HTTP discovery affordance is RFC 9728's WWW-Authenticate resource_metadata pointer, which is a header, not markup. (3) Consumers: no client vendor documents parsing HTML for MCP hints. If SEP-2127 later registers a relation this should be revisited, but as of 2026-08-20 auditing for it would report a signal that cannot be consumed by anything. Note the contrast with the registered `api-catalog` link relation (RFC 9727), which IS real and is the correct existing mechanism for linking machine-readable service descriptions from a document.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [IANA Link Relation Types registry](https://www.iana.org/assignments/link-relations/link-relations-1.csv) · [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [MCP Specification 2026-07-28 — Authorization (RFC 9728 protected-resource metadata)](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/specification/2026-07-28/basic/authorization/index.mdx)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/sunset/meta-tags/mcp-discovery-link.md](../../sunset/meta-tags/mcp-discovery-link.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
