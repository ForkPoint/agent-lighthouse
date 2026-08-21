---
audit: meta-tags/mcp-discovery-link
category: meta-tags
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
