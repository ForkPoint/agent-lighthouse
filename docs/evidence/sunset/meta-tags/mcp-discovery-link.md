---
audit: meta-tags/mcp-discovery-link
category: meta-tags
audit_id: "4.17"
source_file: packages/core/src/audits/meta-tags/mcp-discovery-link.ts
slug: mcp-discovery-link
review_verdict: delete
severity: medium
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# mcp-discovery-link — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: this is the most genuinely promising of the four, because the need is real and acknowledged by MCP's own maintainers. If a site could advertise its MCP server from its homepage HTML, an agent that already fetched the page would learn the site offers programmatic actions without any manual configuration — the exact 'agents cannot discover your MCP server' gap the audit describes. HTML link-rel advertisement is a well-precedented pattern (RSS, canonical, webmention), so `<link rel="alternate" type="application/json" title="MCP Server">` is a reasonable thing to guess. For the audit to matter, some MCP client would have to parse HTML head links.

## What we searched

I read the MCP 2025-06-18 authorization spec in full to map the protocol's actual discovery mechanism. Discovering from modelcontextprotocol.io/llms.txt that a newer spec version (2026-07-28) exists with a dedicated 'Discovery' page, I fetched that page specifically to test whether HTML or well-known discovery had since been added. I then used the GitHub API to search the modelcontextprotocol/modelcontextprotocol spec repo for well-known and HTML-link discovery proposals, found SEP-1649, read its full body and closing comments, and traced it to successor PR #2127 to check whether it had merged. I ran a targeted code search for rel="mcp" across the entire spec repo. I checked IANA for an 'mcp'/'mcp.json' well-known registration, and fetched Anthropic's own Claude custom-connectors documentation to see how Claude actually finds a remote MCP server.

## Best evidence found for the audit

The strongest evidence is that site-level MCP discovery is a live, Anthropic-sponsored draft — but for a different mechanism than the audit checks. SEP-1649 'MCP Server Cards: HTTP Server Discovery via .well-known', authored by @dsp-ant (Anthropic) and @nickcoai, proposes exactly the capability the audit gestures at, citing pain points including 'No Domain-Level Discovery: Clients cannot automatically discover available MCP servers on a domain.' It was closed as COMPLETED on 2026-01-26 only because it migrated to a PR-based workflow, continuing as PR #2127, which remains OPEN as of this research and now proposes a `.well-known/ai-catalog.json` endpoint. Notably a commenter (yoannarz) raised precisely the site-to-server reverse-discovery case and its scope was left unanswered. So the concept is alive — but it is a well-known JSON endpoint, never an HTML link tag, and it is unratified.

## Counter-evidence

Positive proof that the specific checked signal has no consumer: (1) GitHub code search across the entire modelcontextprotocol/modelcontextprotocol repository for rel="mcp" returns total_count=0 — no HTML link-rel discovery appears in any MCP spec, draft, SEP, or blog post. (2) The ratified 2026-07-28 discovery mechanism is `server/discover`, a JSON-RPC method sent to an already-known server ('lets a client query a server's supported protocol versions, capabilities, and identity before sending any other requests') — it presupposes you already have the endpoint and therefore cannot solve web discovery at all. (3) The 2025-06-18 authorization spec's discovery is entirely HTTP-header and well-known based: servers 'MUST use the HTTP header WWW-Authenticate' and clients 'GET /.well-known/oauth-protected-resource' per RFC 9728. No HTML involved. (4) Anthropic's own documentation shows Claude does NOT auto-discover: users must 'Add your connector's remote MCP server URL' manually under Customize > Connectors — the audit names Claude as a consumer that demonstrably is not one. (5) 'mcp' and 'mcp.json' are absent from the IANA Well-Known URIs registry. (6) PR #2127 has not merged, and it renamed the endpoint away from mcp.json to ai-catalog.json, so even the draft path the audit's example file (/mcp.json) resembles is not current.

## Verdict

**confirmed dead — delete** (grade D)

Grade D for the signal as implemented. The audit checks for `<link rel="alternate" type="application/json" title="MCP">` or rel="mcp-discovery" in HTML head — a construct that appears nowhere in MCP's specs, drafts, or SEPs (code search: 0 hits), that no MCP client parses, and that Anthropic's own connector docs contradict by requiring manual URL entry. It names Claude and ChatGPT as consumers when neither reads HTML head for MCP servers. Per the rubric, grade D is dead regardless of the concept's merit. Flagging clearly for the rewrite backlog, since this is the one audit with a real redemption path: SEP-2127 (Anthropic-sponsored, currently OPEN) proposes `/.well-known/ai-catalog.json` server cards for exactly this domain-level discovery need. An audit rewritten to check that path would be a legitimate grade-B forward-looking check once the PR merges — but it must check a well-known JSON endpoint, not an HTML link tag, and should be held until ratification rather than shipped against an open draft.

## Sources

- **[MCP Specification 2026-07-28 — Discovery (server/discover)](https://modelcontextprotocol.io/specification/2026-07-28/server/discover.md)** — Model Context Protocol (spec, URL verified 2026-08-21)
  - The current ratified discovery mechanism is a JSON-RPC method, not web discovery: 'server/discover lets a client query a server's supported protocol versions, capabilities, and identity before sending any other requests. Servers MUST implement it.' It is sent to an endpoint the client already has, so it cannot help an agent find a server from a website. No /.well-known/ path and no HTML link tag appear anywhere on the page.
- **[MCP Specification 2025-06-18 — Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-21)
  - All discovery is HTTP-header and well-known based: MCP servers 'MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728)', 'MUST use the HTTP header WWW-Authenticate' on 401, and clients 'GET /.well-known/oauth-protected-resource'. There is no mention of HTML, link tags, or link rel anywhere in the document.
- **[SEP-1649: MCP Server Cards — HTTP Server Discovery via .well-known](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649)** — Model Context Protocol (authors @dsp-ant, @nickcoai) (spec, URL verified 2026-08-21)
  - Status: Draft. Created 2025-10-14, closed COMPLETED 2026-01-26 solely to migrate to a PR-based workflow ('This SEP has been moved to a PR-based workflow per SEP-1850. Continued in: #2127'). Proposes .well-known/mcp.json to fix stated pain points including 'No Domain-Level Discovery: Clients cannot automatically discover available MCP servers on a domain.' Confirms the audit's underlying need is real and Anthropic-sponsored — and that the sanctioned mechanism is a well-known JSON endpoint, never an HTML link tag.
- **[SEP-2127: MCP Server Cards - HTTP Server Discovery (open PR)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127)** — Model Context Protocol (spec, URL verified 2026-08-21)
  - State: OPEN (created 2026-01-21, not merged as of this research). Successor to SEP-1649. Now proposes '.well-known/ai-catalog.json: HTTP endpoint for pre-connection discovery' — renamed away from mcp.json. Domain-level MCP discovery therefore remains an unratified draft, and the endpoint name has already changed, so no audit should be scored against it yet.
- **[About custom connectors (remote MCP servers) — Claude Help Center](https://support.claude.com/en/articles/11175166-about-custom-connectors-remote-mcp-servers)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Directly contradicts the audit's named consumer. Claude requires manual URL entry, not auto-discovery: users 'Navigate to Customize > Connectors', 'Click + then Add custom connector', and 'Add your connector's remote MCP server URL.' No auto-detection from website HTML or /.well-known/ files is mentioned.
- **[GitHub code search: rel="mcp" in the MCP specification repository](https://github.com/modelcontextprotocol/modelcontextprotocol)** — GitHub (code search API) (repo, URL verified 2026-08-21)
  - Search for rel="mcp" scoped to repo:modelcontextprotocol/modelcontextprotocol returns total_count=0 — the HTML link-rel discovery mechanism the audit checks for does not exist in any MCP spec, SEP, draft, or blog post. By contrast '.well-known/mcp.json' does appear (seps/2575-stateless-mcp.md, docs/seps/2575-stateless-mcp.mdx, blog/content/posts/2025-12-19-mcp-transport-future.md), confirming the well-known path is the discussed mechanism.
- **[IANA Well-Known URIs Registry (checked for mcp)](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - 'mcp' and 'mcp.json' are absent from the 180+ registered well-known suffixes, consistent with SEP-2127 still being an unmerged draft.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/meta-tags/mcp-discovery-link.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

The MCP (Model Context Protocol) discovery link in <head> enables AI agents like Claude and ChatGPT to find and connect to your site's tool endpoints. This is how agents discover that your site offers programmatic actions (search, booking, data queries) beyond static content. Without it, agents cannot discover your MCP server.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and I verified them live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day I checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Counter-evidence:** The SEP is NOT merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is NOT in the IANA Well-Known URIs registry (152 entries checked; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text has 5 stars. No MCP client vendor documents consuming it: Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server' and OpenAI's Apps SDK routes through developer-mode URL paste plus 'public plugin submission' with 'domain verification'. My probe of 19 major domains found only 2 publishers (Vercel, Zapier). SEP-2127 itself lists 'No Domain-Level Discovery' as an _unsolved_ pain point, which is an admission that the mechanism does not yet work.
**Consumers:** none-known (no shipping MCP client documents fetching this path) · **Recommended tier:** informative

**Sources:** [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [Agent-Card/ai-catalog — working repository for common AI Card standard](https://github.com/Agent-Card/ai-catalog) · [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) · [Model Context Protocol — Versioning (current revision 2026-07-28)](https://modelcontextprotocol.io/specification/versioning) · [Third party connectors with remote MCP — Claude Docs](https://claude.com/docs/connectors/custom/remote-mcp) · [OpenAI Apps SDK — Deploy](https://developers.openai.com/apps-sdk/deploy/) · [Live deployment: Vercel /.well-known/ai-catalog.json](https://vercel.com/.well-known/ai-catalog.json) · [Live deployment: Zapier /.well-known/ai-catalog.json](https://zapier.com/.well-known/ai-catalog.json)

#### Signal: mcp-discovery-link-relation-in-html — grade D (agent-action-surfaces)

**Mechanism:** Adding <link rel="mcp" href="..."> or an equivalent <meta> tag to a page's <head> causes an AI agent or crawler to discover the site's MCP server.

**Evidence:** No evidence of any kind was found supporting this. It appears to be an SEO-analogy invention rather than a real mechanism.

**Counter-evidence:** Decisive negatives on three axes. (1) IANA: the Link Relation Types registry contains no `mcp`, `mcp-server`, `agent`, or `webmcp` relation — an unregistered rel value has no defined semantics. (2) Specs: I read the full SEP-2127 diff (424 lines) and it contains no link relation and no HTML-level discovery whatsoever; the extension's docs/discovery.md defines only the well-known URI and catalog entries; the ratified MCP spec's only HTTP discovery affordance is RFC 9728's WWW-Authenticate resource_metadata pointer, which is a header, not markup. (3) Consumers: no client vendor documents parsing HTML for MCP hints. If SEP-2127 later registers a relation this should be revisited, but as of 2026-08-20 auditing for it would report a signal that cannot be consumed by anything. Note the contrast with the registered `api-catalog` link relation (RFC 9727), which IS real and is the correct existing mechanism for linking machine-readable service descriptions from a document.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [IANA Link Relation Types registry](https://www.iana.org/assignments/link-relations/link-relations-1.csv) · [SEP-2127: MCP Server Cards — HTTP Server Discovery (pull request)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) · [experimental-ext-server-card — docs/discovery.md](https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md) · [MCP Specification 2026-07-28 — Authorization (RFC 9728 protected-resource metadata)](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/specification/2026-07-28/basic/authorization/index.mdx)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/meta-tags/mcp-discovery-link.md`; that copy removed (one dossier per removed audit, under `sunset/`).
