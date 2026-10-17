---
audit: operability-safety/ghost-clickable-element-ratio
category: operability-safety
source_file: packages/core/src/audits/operability-safety/ghost-clickable-element-ratio.ts
slug: ghost-clickable-element-ratio
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - playwright-mcp-repo
  - S15
  - lh-a11ytree
  - S9
  - S1
  - S18
  - S8
---

# Ghost-Clickable Element Ratio

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Measures the share of on-page click targets that a DOM or accessibility-tree agent cannot address at all. These are elements that look and behave clickable to a human or a vision model, but expose no native role, no ARIA role and no accessible name. They never appear in a Playwright-MCP style snapshot. Reported as ghost / (ghost + semantic) with a per-element evidence table.

## Claimed mechanism (falsifiable)

Falsifiable claim. An element is omitted from the serialized accessibility snapshot that agent toolkits send to the model when two things hold. Its click behaviour comes only from a JS listener on a non-interactive tag, or from cursor:pointer styling. And it carries no role and no accessible name. Every action tool in those toolkits addresses elements by snapshot reference, so the agent cannot emit a valid click for such an element. It must either fail or fall back to coordinate clicking. Test: take a working <button aria-label="Add to cart">, replace it with an equivalently-styled <div onclick>, re-run browser_snapshot — the ref disappears and browser_click has no valid target. Reverse the change and the ref returns.

## Evidence

- **[Playwright MCP server](https://github.com/microsoft/playwright-mcp)** — Microsoft (repo, URL verified 2026-08-20)
  - Default mode is 'Playwright's accessibility tree, not pixel-based input'; browser_snapshot returns interactive elements with roles and accessible names, and every action tool takes a 'target' = 'exact target element reference from the page snapshot'. Coordinate clicking exists only behind the optional --caps=vision flag. Therefore an element absent from the a11y snapshot is literally unaddressable by the default toolchain.
- **[browser-use DOM extraction: enhanced_snapshot.py](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/enhanced_snapshot.py)** — Browser Use (repo, URL verified 2026-08-20)
  - Parses CDP DOMSnapshot for exactly these computed styles: display, visibility, opacity, overflow, overflow-x, overflow-y, cursor, pointer-events, position, background-color — plus bounding boxes, client rects, scroll rects, paint order and stacking contexts, and a CDP isClickable flag. Confirms production agents infer interactivity from cursor style and occlusion/paint order, so cursor:pointer-without-role and overlay occlusion are first-class, measurable inputs to a real agent's world model.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - It filters the accessibility violations Lighthouse already collects down to about 37 axe rules: button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, and the table and definition-list rules. Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[Why Do LLM-based Web Agents Fail? A Hierarchical Planning Perspective](https://arxiv.org/abs/2603.14248)** — arXiv (study, URL verified 2026-08-20)
  - Decomposes failures across planning, execution and replanning layers and concludes 'low-level execution remains the dominant bottleneck', arguing that 'improving perceptual grounding and adaptive control, not only high-level reasoning, is critical'. Supports prioritising DOM-level operability checks over content/semantics checks when predicting agent task failure.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).

## Example failure

A product grid renders each tile as <div class="product-tile" onclick="goTo(id)"> with the title in a nested <span>. Humans and screenshot agents click tiles fine. Playwright-MCP's snapshot shows only generic text nodes with no refs, so the agent reports 'I cannot find a link for this product' and either scrolls indefinitely (WebVoyager's 44.4% navigation-stuck bucket) or guesses a URL.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The clickability and accessible-name helpers live in `_agent-affordances.ts`. Several audits in this category share them, so the patterns cannot drift apart.
- The ratio is reported as semantic / (semantic + ghost). The floor is 0.9: a page at 0.9 warns, below it fails, and a page with no ghost passes.
- The empty-name arm covers `<a>`, `<button>` and `<summary>` only. A form control usually takes its name from `<label for>`, which this resolution does not follow.
- A ghost whose ancestor was already flagged on the click-signal arm is not counted again.
- An element whose only signal is a class name or a cursor is not a ghost when it holds a control. Controls are `a[href]`, `button`, `select`, `textarea`, `summary`, a non-hidden `input` or a widget role. Decorative roles such as `presentation`, `img` and `status` supply no action.
- Such an element is also not a ghost when it sits inside a link, a button, a `summary` or a widget role. A click on it is the control's click.
- An inline handler is the element's own action and always flags it, except inside a control. There it counts only when it stops the event with `stopPropagation`, `stopImmediatePropagation` or `cancelBubble`.
- Roles are read like the ARIA role attribute: case-insensitive, first concrete token wins. A wrapper around a `gridcell` or `scrollbar` holds a control. `progressbar` takes no input, so it does not.

## Deferred

- The headless CDP tier, which intersects event listeners and cursor data with the full accessibility tree. The scanner drives no live browser.
- Listener-based detection. A listener added with `addEventListener` is invisible in served markup, so the class vocabulary and the `cursor: pointer` rule stand in for it.
- Occlusion and paint order. They need layout, so overlay interception is left to the headless tier.
