---
check: url-addressable-state-and-pagination-fallback
title: "URL-Addressable State and Pagination Fallback"
domain: agent-operability
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# URL-Addressable State and Pagination Fallback

> Proposed check. Evidence grade **B** · unique · implementation: `multi-page`

## What it checks

Checks that every distinct content state a task might need to reach — page N of a listing, an applied filter set, a selected tab, an opened detail view — is reachable by navigating to a URL, and that infinitely-scrolled collections expose a crawlable/enumerable alternative.

## Claimed mechanism (falsifiable)

Falsifiable claim: an agent's dominant recovery primitive is re-navigation. When a step fails, context is truncated, or a fresh session resumes a task, the agent re-enters the state by going to a URL; if the state lives only in JS memory, recovery requires replaying the entire interaction sequence from the homepage, consuming the step budget. WebVoyager attributes 44.4% of all failures to navigation-stuck, explicitly citing exhausted step budgets and difficulty locating the correct scrollable area. Test: expose ?page=N and filter params on the same listing; the number of actions to reach item #180 drops from ~30 scroll-and-wait cycles to one navigation.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.
- **[Why Do LLM-based Web Agents Fail? A Hierarchical Planning Perspective](https://arxiv.org/abs/2603.14248)** — arXiv (study, URL verified 2026-08-20)
  - Decomposes failures across planning, execution and replanning layers and concludes 'low-level execution remains the dominant bottleneck', arguing that 'improving perceptual grounding and adaptive control, not only high-level reasoning, is critical'. Supports prioritising DOM-level operability checks over content/semantics checks when predicting agent task failure.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.

## Competitor coverage

Not covered as an agent check. SEO crawlers report 'orphaned content' and JS-rendering coverage, but score it against indexability, not against an agent's per-task action budget and recovery path; Lighthouse's agentic category has no navigation or state-addressability audit, and answer-engine trackers do not crawl interaction state at all.

## Implementation sketch

Multi-page crawl. For each listing/collection page: (1) count items present in the initial HTML and compare against a declared total (result-count text, or schema.org numberOfItems); (2) look for real pagination — <a href> page links, <link rel="next">, or a URL parameter matching /page|offset|start|p=|from=/ that changes results when varied; (3) detect infinite-scroll machinery (IntersectionObserver sentinel div near the list end, class matching /infinite|load-more|sentinel/, or a 'Load more' button) and fail when it is present with no href-based fallback. Note that a 'Load more' <button> scores better than a pure scroll sentinel but worse than href pagination, since it is at least a discrete action. Separately, for faceted listings, fetch the page with each facet's declared value as a query parameter and verify the server returns filtered results (facet is URL-addressable) versus identical unfiltered HTML (facet is client-only). Headless tier extends this to tabs and modals by clicking each and asserting location.href changed. Report the deepest item index reachable by URL alone.

## Example failure

A jobs board renders 15 of 400 listings and appends more via an IntersectionObserver, with filters held in React state and no query parameters. Asked to 'find the remote Rust role in Berlin', the agent must scroll roughly 26 times with a network wait each, cannot deep-link the filtered view, and blows its step budget — and if it does find the role, it cannot hand the user a link to it.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
