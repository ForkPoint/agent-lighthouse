---
audit: operability-safety/url-addressable-state-and-pagination-fallback
category: operability-safety
source_file: packages/core/src/audits/operability-safety/url-addressable-state-and-pagination-fallback.ts
slug: url-addressable-state-and-pagination-fallback
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S1
  - S13
  - S18
  - S2
---

# URL-Addressable State and Pagination Fallback

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `multi-page`

## What it checks

Checks that every distinct content state a task might need to reach is reachable by navigating to a URL: page N of a listing, an applied filter set, a selected tab, an opened detail view. Also checks that infinitely-scrolled collections expose a crawlable or enumerable alternative.

## Claimed mechanism (falsifiable)

Falsifiable claim: an agent's dominant recovery primitive is re-navigation. A step may fail, context may be truncated, or a fresh session may resume a task. The agent then re-enters the state by going to a URL. If the state lives only in JS memory, recovery requires replaying the entire interaction sequence from the homepage, which consumes the step budget. WebVoyager attributes 44.4% of all failures to navigation-stuck, explicitly citing exhausted step budgets and difficulty locating the correct scrollable area. Test: expose ?page=N and filter params on the same listing; the number of actions to reach item #180 drops from ~30 scroll-and-wait cycles to one navigation.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.
- **[Why Do LLM-based Web Agents Fail? A Hierarchical Planning Perspective](https://arxiv.org/abs/2603.14248)** — arXiv (study, URL verified 2026-08-20)
  - Decomposes failures across planning, execution and replanning layers and concludes 'low-level execution remains the dominant bottleneck', arguing that 'improving perceptual grounding and adaptive control, not only high-level reasoning, is critical'. Supports prioritising DOM-level operability checks over content/semantics checks when predicting agent task failure.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.

## Example failure

A jobs board renders 15 of 400 listings and appends more via an IntersectionObserver, with filters held in React state and no query parameters. Asked to 'find the remote Rust role in Berlin', the agent must scroll roughly 26 times, with a network wait on each. It cannot deep-link the filtered view, and it blows its step budget. If it does find the role, it cannot hand the user a link to it.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- `applicablePageTypes` is `['category']`. With no listing page the audit returns `notApplicable`.
- Pagination is graded in three steps. An `href` or `rel="next"` passes. A "Load more" button warns. Scroll machinery alone fails.
- The declared-total check fires only when the total exceeds the rendered items by more than half.
- Facet probing is capped at two same-origin GETs per listing, through the shared sampled-page cache. A facet is client-only when the response is byte-identical to the unfiltered page, or holds the same number of items.

## Deferred

- Tabs and modals. Clicking each and checking `location.href` needs a live browser.
- Varying the page parameter. The audit trusts the page numbers the listing advertises rather than fetching `?page=2`.
- Unlabelled facet links. Only links whose class, `data-filter` or parent class reads as a facet are probed.
