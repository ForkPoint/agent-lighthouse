---
audit: operability-safety/first-contact-consent-gate-operability
category: operability-safety
source_file: packages/core/src/audits/operability-safety/first-contact-consent-gate-operability.ts
slug: first-contact-consent-gate-operability
evidence_grade: C
tier: informative
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
---


# First-Contact Consent Gate Operability

> Shipped in v2. Evidence grade **C** · informative tier · unique · implementation: `static-fetch`

## What it checks

Evaluates the cold-session interstitial an agent meets before any task work: whether primary content exists in the DOM behind the consent layer, whether the accept and reject controls have accessible names and live in the main document rather than a cross-origin iframe, and whether the layer traps the agent via inert/aria-hidden on main content.

## Claimed mechanism (falsifiable)

Plausible-convention claim: an agent arriving with no cookies must spend its first actions dismissing a consent layer before any task step. Three properties determine whether it can. (1) If the layer is rendered inside a cross-origin third-party iframe, DOM-text extractors that read only the top document return the underlying page text while the screenshot shows a blocker — the agent's two modalities disagree and it acts on stale content. (2) If the accept/reject controls are unroled or unnamed divs, they are unaddressable in the snapshot for the same reason as the Ghost-Clickable check. (3) If main content is set inert or aria-hidden while the layer is open, every subsequent snapshot is empty until the layer is dismissed, and axe's own guidance notes that aria-hidden removes the element and all children from the accessibility API. WebVoyager names pop-up windows among the things real sites throw at agents. Test: load with a clean profile and diff the snapshot against a post-consent load.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).
- **[Playwright MCP server](https://github.com/microsoft/playwright-mcp)** — Microsoft (repo, URL verified 2026-08-20)
  - Default mode is 'Playwright's accessibility tree, not pixel-based input'; browser_snapshot returns interactive elements with roles and accessible names, and every action tool takes a 'target' = 'exact target element reference from the page snapshot'. Coordinate clicking exists only behind the optional --caps=vision flag. Therefore an element absent from the a11y snapshot is literally unaddressable by the default toolchain.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.

## Competitor coverage

Not covered. Consent-layer auditing exists in the privacy-compliance tool space (Cookiebot scanners, CMP validators) but is scored against GDPR/TCF conformance, never against agent operability or action cost. Lighthouse's agentic category ignores interstitials entirely.

## Implementation sketch

Static tier: fetch with no cookies and no consent signals. Detect a CMP by script host or global (__tcfapi, OneTrust/otSDKStub, Cookiebot, Didomi, Quantcast/quantcast choice, Osano, Usercentrics, Sourcepoint). Then assert: (a) the page's primary content (article body, product data, or main landmark text) is present in the returned HTML rather than replaced by an interstitial — compare content length and presence of the JSON-LD main entity against a second fetch carrying a consent cookie; (b) the consent dialog's accept and reject controls resolve to elements with a button/link role and a non-empty accessible name, in the top document; fail when the dialog root is an <iframe> with a cross-origin src; (c) main content is not marked inert or aria-hidden=true for the duration; (d) the dialog is dismissible without a scroll-inside-iframe or a multi-step 'manage preferences' journey — count the minimum clicks to reject. Headless tier verifies (c) and (d) by actually running the dismissal and counting actions. Report as a diagnostic with an action-cost number rather than a pass/fail score.

## Example failure

A news site loads a Sourcepoint dialog in a cross-origin iframe and sets aria-hidden="true" on <main>. An agent reading page text via DOM extraction gets the article (the text is in the DOM) but its accessibility snapshot is empty except for an unnamed iframe, so it cannot find any clickable element; asked to click 'Reject all' it reports that no such control exists on the page.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

The shipped audit is `operability-safety/first-contact-consent-gate-operability`,
in the `operability-safety` category: the proposal's `agent-operability` domain
is a research grouping, not one of the eight v2 categories.

It is registered in the `informative` tier with weight 0, as grade C requires.
The sketch already asks for "a diagnostic with an action-cost number rather than
a pass/fail score", so the tier and the sketch agree.

The consent-cookie comparison in arm (a) is not made. The sketch fetches the
page a second time carrying a consent cookie and diffs the two. Sending a
fabricated consent signal is a claim about a visitor's choice that a scanner has
no standing to make, so content presence is judged from the single served
response: a main landmark or article holding at least 200 characters, or a
JSON-LD main entity beside shorter text.

The action cost is read from the controls rendered in the top document: a
control whose accessible name, id or class reads as a refusal costs one click, a
"manage preferences" journey costs two, and a layer with neither is reported as
having no refusal control at all rather than being given a number.

## Deferred

- **Headless verification of arms (c) and (d).** The sketch runs the dismissal
  and counts the actions it really takes. That needs a live browser, so the
  shipped audit counts the controls the markup declares instead.
- **Controls inside a cross-origin iframe.** When the layer is in a third-party
  frame, its controls cannot be read at all — which is itself the finding. No
  action cost is attributed in that case.
- **Scroll-inside-iframe dismissal.** Whether the dialog needs a scroll before
  its buttons come into reach depends on layout, which does not exist before
  rendering.
