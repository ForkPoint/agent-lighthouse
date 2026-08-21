---
check: native-control-substitution-index
title: "Native Control Substitution Index"
domain: agent-operability
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Native Control Substitution Index

> Proposed check. Evidence grade **A** · unique · implementation: `static-fetch`

## What it checks

Counts choice, date, and file-input controls implemented as custom div widgets instead of the native HTML elements, weighted by whether they sit on a conversion-critical path (search, filter, checkout, signup). Reports each substituted control with the number of agent actions it costs versus its native equivalent.

## Claimed mechanism (falsifiable)

Falsifiable claim: native <select>, <input type="date">, and <input type="file"> are single-call primitives in every mainstream agent toolkit (selectOption, fill, setInputFiles) and are keyboard-operable, so they succeed in one action with no actionability risk. A custom equivalent requires open → wait for popup → scroll the option list into view → locate the option → click, where each step is independently subject to Playwright's visible/stable/receives-events gates, and Anthropic documents dropdowns specifically as 'tricky for Claude to manipulate using mouse movements'. Test: instrument the same form with native vs custom controls and count tool calls and retries to reach an identical value.

## Evidence

- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Competitor coverage

Not covered. Lighthouse's agentic category has no control-substitution audit; axe's aria-required-attr will demand aria-expanded on an element that already declares role=combobox but says nothing when the widget declares no role and nothing about the native-vs-custom choice. Lighthouse's webmcp-form-coverage audit checks for declarative WebMCP tool exposure, an orthogonal (and far less deployed) mechanism.

## Implementation sketch

Static parse. For each <form> and each labelled field region, classify the control: NATIVE if <select>, <input type=date|month|time|file|color|range>; SUBSTITUTED if the region contains no native control but does contain (a) role="combobox"/"listbox"/"menu" markup, (b) a hidden <input type="hidden"> or type="text" readonly paired with a clickable div whose class matches /select|dropdown|picker|calendar|datepicker|chooser/, or (c) a drop-zone div (class matching /drop.?zone|file.?drop|upload.?area/) with no sibling <input type="file">. Weight fields on paths matched by URL or form action containing /checkout|cart|signup|register|book|order|search/. For each SUBSTITUTED control additionally check whether the ARIA combobox contract is satisfiable per APG (aria-expanded present, aria-controls resolving to an existing element whose role is listbox/grid/tree/dialog, options carrying role=option, aria-activedescendant ids resolvable) — a substituted control with a complete contract is a warning; one with a broken or absent contract is a failure.

## Example failure

A checkout ships a styled country picker: <div class="dropdown" tabindex="0"> plus a virtualised <ul> that only renders 20 of 195 countries at a time, and a hidden input carrying the value. Playwright's selectOption is unusable; the agent opens the list, sees 20 entries, does not find 'Netherlands', and has no scroll target inside the popup — the same 'difficulty locating correct scrollable areas' failure WebVoyager names as a driver of navigation-stuck.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
