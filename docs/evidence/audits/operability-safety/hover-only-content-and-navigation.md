---
audit: operability-safety/hover-only-content-and-navigation
category: operability-safety
source_file: packages/core/src/audits/operability-safety/hover-only-content-and-navigation.ts
slug: hover-only-content-and-navigation
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S2
  - S11
  - playwright-mcp-repo
  - S3
  - S1
---

# Hover-Only Content and Navigation

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Detects navigation subtrees and information that exist in the DOM only while a pointer hovers — CSS :hover-revealed submenus with no focus or aria-expanded equivalent, and content carried solely in title attributes or hover cards.

## Claimed mechanism (falsifiable)

Falsifiable claim. A submenu revealed only by an ancestor :hover rule is display:none or visibility:hidden in the resting DOM. Playwright's actionability contract defines such an element as not visible. Every Playwright-derived agent therefore refuses to click it, and the snapshot serializer omits it entirely. The agent therefore never learns those destinations exist. WebSuite measures the information-retrieval half of this at 0% success for tooltip-based content across both agents tested. Test: add a :focus-within (or JS-toggled aria-expanded) path to the same menu; the submenu becomes reachable in the snapshot and the destination becomes clickable without any hover synthesis.

## Evidence

- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Playwright MCP server](https://github.com/microsoft/playwright-mcp)** — Microsoft (repo, URL verified 2026-08-20)
  - Default mode is 'Playwright's accessibility tree, not pixel-based input'; browser_snapshot returns interactive elements with roles and accessible names, and every action tool takes a 'target' = 'exact target element reference from the page snapshot'. Coordinate clicking exists only behind the optional --caps=vision flag. Therefore an element absent from the a11y snapshot is literally unaddressable by the default toolchain.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Example failure

A B2B site puts its entire product catalogue behind a mega-menu revealed by .nav-item:hover .mega-panel { display:block }, with the top-level 'Products' element being an <a> without href. A Playwright-MCP agent asked to 'find the pricing for the Enterprise tier' sees a nav containing only Home, About and Contact, concludes the site has no product pages, and falls back to a web search.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The audit sits in `operability-safety`. The proposal's `agent-operability` domain is a research grouping, not a category.
- A `:hover` rule is a finding only when the element it reveals is also hidden at rest by a rule with no state pseudo-class. A hover that only changes opacity from 0.8 to 1 reveals nothing.
- "No JS toggle is plausible" is read from three markers around the submenu: `aria-expanded` or `aria-haspopup`, an inline click, keydown, mousedown or focus handler, or an `aria-controls` reference to the submenu's id. Any one stops the finding. The audit does not run scripts, so it must not report a menu it cannot prove unreachable.
- A `title` that repeats what the element already says is not counted. That covers its text, `aria-label`, `aria-labelledby` target text and the `alt` of an image inside it, in any letter case. A title whose content words (three letters or more) all appear there also repeats it.
- Form controls, `<iframe>`, `<frame>`, `<link>` and `<abbr>` are exempt from the title check. Their `title` is a label the platform already exposes.
- The two halves are graded apart. A lost destination fails. A title-only string or an unreferenced hover card warns, because the agent still reaches every page.

## Deferred

- **Headless snapshot diff.** Dispatching a synthetic hover on each nav trigger and diffing the exposed link set needs a live browser, which the scanner does not drive.
- **Transition-revealed menus.** A submenu revealed by `transform` or `transition` on hover is not detected. Its end state depends on layout.
- **Cross-origin stylesheets.** A scan never fetches a third party's CSS. The result says when a sheet was skipped, so a partial read does not read as clean.
