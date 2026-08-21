---
check: drag-and-slider-dependency
title: "Drag and Slider Dependency"
domain: agent-operability
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Drag and Slider Dependency

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Flags interactions on task-critical paths whose only operation path is a continuous pointer gesture — range sliders, drag-to-reorder lists, drag-only upload zones, swipe carousels — with no click, keyboard, or typed-value alternative.

## Claimed mechanism (falsifiable)

Falsifiable claim: continuous pointer gestures require an agent to synthesise a pointerdown, a sequence of intermediate pointermove events, and a pointerup at a computed pixel offset, with no feedback loop between steps and no way to verify the interim value; every other agent action is discrete and verifiable. WebSuite measures slider interaction at 0% success for both agents tested — the single worst primitive in its taxonomy — and Anthropic separately documents scrollbars and dropdowns as tricky under mouse control, recommending keyboard shortcuts instead. Test: pair the slider with a numeric <input> bound to the same value; the agent's success on 'set max price to 300' goes from 0 to near-certain because it becomes a fill action.

## Evidence

- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.

## Competitor coverage

Not covered. Lighthouse's agentic audit inherits axe's aria-required-attr which will fire on a declared role=slider missing aria-valuenow, but the far more common unroled div-thumb slider, drag-only upload, and drag-reorder cases produce no finding anywhere. No competitor scores discrete-alternative availability.

## Implementation sketch

Static parse. Flag (a) <input type="range"> or role="slider" that is not accompanied within the same labelled field group by a numeric <input> or a <select> bound to the same parameter — and additionally fail any role="slider" missing aria-valuenow/aria-valuemin/aria-valuemax or an accessible name per APG, since without them the agent cannot even read the current value; (b) elements with draggable="true" (or class matching /sortable|draggable|drag-handle|reorder/) inside a list on a path matched by /cart|checkout|builder|configure|order/ with no adjacent move-up/move-down buttons or position <select>; (c) drop-zone divs with no sibling or descendant <input type="file"> (drag-only upload is unoperable — agents set files on an input, they do not synthesise a DataTransfer drop); (d) carousels whose only next/prev affordance is touch/swipe handlers with no rendered button controls. Weight by path criticality. Every finding names the missing discrete alternative, which is the remediation.

## Example failure

A hotel search gates results behind a dual-thumb price range slider (two divs with no role and no aria-value*) and a drag-only date range. Asked to find rooms under 200 EUR, the agent has no readable current value, no keyboard path, and no numeric input; it drags approximately, cannot read where it landed, and returns results for the wrong range while asserting the filter was applied.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
