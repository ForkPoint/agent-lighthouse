---
audit: operability-safety/drag-and-slider-dependency
category: operability-safety
source_file: packages/core/src/audits/operability-safety/drag-and-slider-dependency.ts
slug: drag-and-slider-dependency
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S11
  - S3
  - S7
  - S2
---

# Drag and Slider Dependency

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Flags interactions on task-critical paths whose only operation path is a continuous pointer gesture — range sliders, drag-to-reorder lists, drag-only upload zones, swipe carousels — with no click, keyboard, or typed-value alternative.

## Claimed mechanism (falsifiable)

Falsifiable claim: continuous pointer gestures require an agent to synthesise a pointerdown, a sequence of intermediate pointermove events, and a pointerup at a computed pixel offset. There is no feedback loop between steps, and no way to verify the interim value. Every other agent action is discrete and verifiable. WebSuite measures slider interaction at 0% success for both agents tested — the single worst primitive in its taxonomy — and Anthropic separately documents scrollbars and dropdowns as tricky under mouse control, recommending keyboard shortcuts instead. Test: pair the slider with a numeric <input> bound to the same value; the agent's success on 'set max price to 300' goes from 0 to near-certain because it becomes a fill action.

## Evidence

- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.

## Example failure

A hotel search gates results behind a dual-thumb price range slider (two divs with no role and no aria-value*) and a drag-only date range. Asked to find rooms under 200 EUR, the agent has no readable current value, no keyboard path and no numeric input. It drags approximately, and cannot read where it landed. It returns results for the wrong range, while asserting the filter was applied.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The two slider arms are counted apart. A `role="slider"` missing a value attribute or an accessible name is reported on the APG arm only. A value an agent cannot read is a different defect from one it cannot set discretely.
- "The same labelled field group" is the enclosing `<fieldset>`, `<form>` or `[role="group"]`, else the parent element. A page-wide search would pass a slider beside an unrelated number field.
- Path criticality is matched on `/cart|checkout|builder|configure|order/`. Wider words such as `seat` or `book` match ordinary editorial URLs.
- The reorder finding is raised once per list, not once per item. One set of move buttons is one fix.

## Deferred

- Criticality is a gate on the reorder arm, not a weight on findings.
- Listener-attached drag. A list made sortable in script carries no `draggable` attribute or matching class. Detecting it needs a headless browser.
- Value binding. The audit checks that a discrete control shares the field group, not that it is bound to the same value.
