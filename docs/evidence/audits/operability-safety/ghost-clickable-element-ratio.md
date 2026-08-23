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
---


# Ghost-Clickable Element Ratio

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Measures the share of on-page click targets that a DOM/accessibility-tree agent cannot address at all: elements that look and behave clickable to a human or a vision model but expose no native or ARIA role and no accessible name, so they never appear in a Playwright-MCP style snapshot. Reported as ghost / (ghost + semantic) with a per-element evidence table.

## Claimed mechanism (falsifiable)

Falsifiable claim: an element whose click behaviour comes only from a JS listener on a non-interactive tag (or from cursor:pointer styling) and which carries no role and no accessible name is omitted from the serialized accessibility snapshot that agent toolkits send to the model; because every action tool in those toolkits addresses elements by snapshot reference, the agent cannot emit a valid click for it and must either fail or fall back to coordinate clicking. Test: take a working <button aria-label="Add to cart">, replace it with an equivalently-styled <div onclick>, re-run browser_snapshot — the ref disappears and browser_click has no valid target. Reverse the change and the ref returns.

## Evidence

- **[Playwright MCP server](https://github.com/microsoft/playwright-mcp)** — Microsoft (repo, URL verified 2026-08-20)
  - Default mode is 'Playwright's accessibility tree, not pixel-based input'; browser_snapshot returns interactive elements with roles and accessible names, and every action tool takes a 'target' = 'exact target element reference from the page snapshot'. Coordinate clicking exists only behind the optional --caps=vision flag. Therefore an element absent from the a11y snapshot is literally unaddressable by the default toolchain.
- **[browser-use DOM extraction: enhanced_snapshot.py](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/enhanced_snapshot.py)** — Browser Use (repo, URL verified 2026-08-20)
  - Parses CDP DOMSnapshot for exactly these computed styles: display, visibility, opacity, overflow, overflow-x, overflow-y, cursor, pointer-events, position, background-color — plus bounding boxes, client rects, scroll rects, paint order and stacking contexts, and a CDP isClickable flag. Confirms production agents infer interactivity from cursor style and occlusion/paint order, so cursor:pointer-without-role and overlay occlusion are first-class, measurable inputs to a real agent's world model.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[Why Do LLM-based Web Agents Fail? A Hierarchical Planning Perspective](https://arxiv.org/abs/2603.14248)** — arXiv (study, URL verified 2026-08-20)
  - Decomposes failures across planning, execution and replanning layers and concludes 'low-level execution remains the dominant bottleneck', arguing that 'improving perceptual grounding and adaptive control, not only high-level reasoning, is critical'. Supports prioritising DOM-level operability checks over content/semantics checks when predicting agent task failure.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).

## Competitor coverage

Not covered. Lighthouse's agent-accessibility-tree audit is a filter over ~37 axe rules; axe's button-name/link-name/input-button-name rules only fire on elements that ALREADY declare button/link semantics, and no axe rule can fail a bare unroled div — the ghost case is invisible to it by construction. Answer-engine tools (Profound, Otterly) and SEO AI toolkits (Semrush, Ahrefs) audit citation/visibility and content, not DOM actionability.

## Implementation sketch

Static tier (default): parse the served HTML plus linked CSS. Flag as ghost any element that (a) is not a natively interactive tag and has no role attribute, AND (b) matches at least one clickability signal — inline onclick/onmousedown/onkeydown, a class or data-attribute matching /(^|[-_])(btn|button|cta|link|clickable|tile|card-link|toggle)([-_]|$)/, or a CSS rule setting cursor:pointer on its selector. Also flag <a> without href (no link role, no snapshot entry) and <button>/<a> whose computed accessible name per accname resolution (content, aria-label, aria-labelledby, title, alt of child img, svg <title>) is empty. Score = 1 - ghost/(ghost+semantic), fail below ~0.9. Headless tier (higher precision): CDP DOMDebugger.getEventListeners over all nodes plus DOMSnapshot cursor/isClickable (the exact signals browser-use consumes) intersected against the CDP Accessibility.getFullAXTree node set; a ghost is any node with a click listener or cursor:pointer whose AX node is ignored or has role generic/none with empty name.

## Example failure

A product grid renders each tile as <div class="product-tile" onclick="goTo(id)"> with the title in a nested <span>. Humans and screenshot agents click tiles fine. Playwright-MCP's snapshot shows only generic text nodes with no refs, so the agent reports 'I cannot find a link for this product' and either scrolls indefinitely (WebVoyager's 44.4% navigation-stuck bucket) or guesses a URL.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The shipped audit is `operability-safety/ghost-clickable-element-ratio`, in the
`operability-safety` category: the proposal's `agent-operability` domain is a
research grouping, not one of the eight v2 categories.

The clickability and accessible-name helpers live in
`packages/core/src/audits/operability-safety/_agent-affordances.ts` rather than
in this audit, because three audits in this category need the same two answers
and the patterns must not drift apart between them.

The ratio is reported as semantic / (semantic + ghost) — the sketch writes the
same quantity as `1 - ghost/(ghost+semantic)`. The floor is 0.9 exactly: a page
at 0.9 warns, below it fails, and a page with no ghost at all passes.

The empty-accessible-name arm is applied to `<a>`, `<button>` and `<summary>`
only. A form control usually takes its name from a `<label for>` association,
which accname resolution over the served markup alone does not follow, so
calling a nameless `<input>` a ghost would be a guess rather than a measurement.

A ghost whose ancestor was already flagged on the click-signal arm is not
counted again, so a clickable wrapper holding a clickable inner div is one
finding rather than two.

## Deferred

- **Headless CDP tier.** The sketch's higher-precision tier intersects
  `DOMDebugger.getEventListeners` and `DOMSnapshot` cursor/`isClickable` against
  `Accessibility.getFullAXTree`. All three need a live browser, which the
  scanner does not drive. The shipped audit is the static tier only, and its
  description does not claim otherwise.
- **Listener-based detection.** Only inline handler attributes are visible in
  served markup. A listener attached with `addEventListener` in a script is not
  detectable without executing the page, so the class-name vocabulary and the
  `cursor: pointer` rule carry that signal instead.
- **Occlusion and paint order.** browser-use consumes bounding boxes, client
  rects and stacking contexts to decide what is really clickable. None of those
  exist before layout, so overlay interception is left to the proposed
  `overlay-interception-hazard` check, which stays blocked on the headless tier.
