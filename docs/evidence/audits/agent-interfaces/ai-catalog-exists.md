---
audit: agent-interfaces/ai-catalog-exists
audit_id: "5.7"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-exists.ts
slug: ai-catalog-exists
review_verdict: delete
severity: high
evidence_grade: A
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-catalog-exists (`5.7`)

> agent-tools · source `ai-catalog-exists.ts` · review verdict **delete** · evidence grade **A** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

The AI catalog is the central discovery file that tells AI agents what capabilities your site offers. Think of it as a table of contents for your APIs, tools, and services. Without it, agents must probe multiple endpoints to understand what your site can do.

## Code review findings (2026-08-20, 11-agent pass)

Invented standard. `/.well-known/ai-catalog.json` is not registered with IANA, is not published by any working group, and is consumed by no crawler or agent. The audit hard-fails effectively every website on the internet at medium priority and tells owners to author a file with a schema this framework made up.

**Required fix:** Delete this audit and its two dependents (5.8, 5.9). If discovery coverage is wanted, spend the weight on real signals: a linked OpenAPI spec, an MCP endpoint, or a well-formed llms.txt.

**False-positive risks:**
- 100% false-fail rate on real sites: no site outside this framework's own scaffolding publishes this file, so the audit is a constant zero that carries no information about the site.
- Even when present, `Array.isArray(parsed['services'])` is the only validation — `{"services": []}` passes as 'AI catalog found with 0 service(s)', a vacuous pass.
- A SPA catch-all returning 200 text/html means JSON.parse fails and the user is told 'ai-catalog.json is not valid JSON' when in fact there is no such file — a confusing, wrong diagnosis.
- WAF 403 on /.well-known/* reads as 'not found'; `ctx.wafProtection` unused.

**Test gaps:**
- No test that an empty services array is a vacuous pass
- No HTML-soft-404 fixture
- No content-type assertion

**Overlaps with:** `5.8`, `5.9`, `5.10`

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an *unsolved* pain point, which is an admission that the mechanism does not yet work.
**Consumers:** none-known (no shipping MCP client documents fetching this path) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Agent-Card/ai-catalog — working repository for common AI Card standard](https://github.com/Agent-Card/ai-catalog) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [Third party connectors with remote MCP — Claude Docs](https://claude.com/docs/connectors/custom/remote-mcp) · [OpenAI Apps SDK — Deploy](https://developers.openai.com/apps-sdk/deploy/) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-exists.md](../../deletions/agent-tools/ai-catalog-exists.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
