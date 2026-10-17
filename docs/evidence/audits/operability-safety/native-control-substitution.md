---
audit: operability-safety/native-control-substitution
category: operability-safety
source_file: packages/core/src/audits/operability-safety/native-control-substitution.ts
slug: native-control-substitution
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S3
  - S5
  - S2
  - S11
  - S1
---

# Native Control Substitution Index

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Counts choice, date, and file-input controls implemented as custom div widgets instead of the native HTML elements, weighted by whether they sit on a conversion-critical path (search, filter, checkout, signup). Reports each substituted control with the number of agent actions it costs versus its native equivalent.

## Claimed mechanism (falsifiable)

Falsifiable claim: native <select>, <input type="date">, and <input type="file"> are single-call primitives in every mainstream agent toolkit (selectOption, fill, setInputFiles) and are keyboard-operable, so they succeed in one action with no actionability risk. A custom equivalent requires five steps: open the control, wait for the popup, scroll the option list into view, locate the option, then click. Each step is independently subject to Playwright's visible, stable and receives-events gates. Anthropic documents dropdowns specifically as 'tricky for Claude to manipulate using mouse movements'. Test: instrument the same form with native vs custom controls and count tool calls and retries to reach an identical value.

## Evidence

- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Example failure

A checkout ships a styled country picker: <div class="dropdown" tabindex="0"> plus a virtualised <ul> that only renders 20 of 195 countries at a time, and a hidden input carrying the value. Playwright's selectOption is unusable; the agent opens the list, sees 20 entries, does not find 'Netherlands', and has no scroll target inside the popup — the same 'difficulty locating correct scrollable areas' failure WebVoyager names as a driver of navigation-stuck.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- The id drops the proposal's `-index` suffix. The result carries the index as a weighted count.
- The "labelled field region" is the control's enclosing `<form>`, or its parent element when there is none. A native control anywhere in that region makes the styled div decoration, and it is not counted.

## Deferred

- **Action-cost reporting.** Counting the agent actions a widget costs needs a headless browser. The audit reports the weighted substitution index and the contract defect instead.
- **Virtualised option lists.** Whether a list renders only part of its options is observable only once its script runs, so it is not assessed.
