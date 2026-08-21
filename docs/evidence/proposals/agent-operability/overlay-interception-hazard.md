---
check: overlay-interception-hazard
title: "Overlay Interception Hazard"
domain: agent-operability
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: headless-browser
scoring_tier: scored
reviewed: 2026-08-20
---

# Overlay Interception Hazard

> Proposed check. Evidence grade **A** · unique · implementation: `headless-browser`

## What it checks

For every interactive element in the viewport, checks whether that element is actually the hit target at its own centre point, and reports the intercepting layer. Catches cookie bars, chat widgets, sticky headers over anchor targets, promo modals, and invisible full-viewport click-catchers.

## Claimed mechanism (falsifiable)

Falsifiable claim: Playwright's actionability contract includes a 'receives events' check — the element must be the hit target for pointer events at the action point — and aborts the action when an overlay intercepts, which is a hard failure for every Playwright-derived agent. Vision-based agents fail differently but equally: they compute the element's coordinates from the screenshot and click the overlay instead. browser-use's snapshot extractor consumes paint order and stacking contexts for exactly this reason. Test: elementFromPoint at an element's centre returning a node that is neither the element nor its descendant predicts the abort deterministically.

## Evidence

- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[browser-use DOM extraction: enhanced_snapshot.py](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/enhanced_snapshot.py)** — Browser Use (repo, URL verified 2026-08-20)
  - Parses CDP DOMSnapshot for exactly these computed styles: display, visibility, opacity, overflow, overflow-x, overflow-y, cursor, pointer-events, position, background-color — plus bounding boxes, client rects, scroll rects, paint order and stacking contexts, and a CDP isClickable flag. Confirms production agents infer interactivity from cursor style and occlusion/paint order, so cursor:pointer-without-role and overlay occlusion are first-class, measurable inputs to a real agent's world model.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[Playwright MCP server](https://github.com/microsoft/playwright-mcp)** — Microsoft (repo, URL verified 2026-08-20)
  - Default mode is 'Playwright's accessibility tree, not pixel-based input'; browser_snapshot returns interactive elements with roles and accessible names, and every action tool takes a 'target' = 'exact target element reference from the page snapshot'. Coordinate clicking exists only behind the optional --caps=vision flag. Therefore an element absent from the a11y snapshot is literally unaddressable by the default toolchain.

## Competitor coverage

Not covered. Lighthouse's agentic category ships layout stability (CLS), which measures elements moving, not elements being covered — a perfectly stable page can have 100% of its CTAs occluded and score a perfect CLS. axe has no occlusion rule. No SEO or answer-engine tool renders and hit-tests.

## Implementation sketch

Headless (roadmap tier). After load and after a settle delay, enumerate interactive nodes (native controls plus anything with an interactive role or a click listener), and for each compute its bounding box centre and call document.elementFromPoint(x, y); flag when the returned node is not the element and not a descendant of it, recording the intercepting element's selector, z-index and position value. Aggregate interceptors so one cookie bar reports once with its blocked-element count rather than N times. Separately flag: position:fixed layers whose z-index exceeds all content and whose area covers more than ~25% of the viewport; invisible full-viewport catchers (fixed elements with opacity 0 or transparent background covering the viewport and no accessible name); and sticky headers whose height exceeds the offset applied to :target/scroll-margin-top, which causes anchor navigation to land on content hidden behind the header. Also worth capturing at two viewport sizes, since 1280x720 — the baseline Anthropic recommends for computer use — is where sticky chrome eats the largest proportion of usable height.

## Example failure

A sticky 'Get 10% off' bar pinned to the bottom of the viewport at z-index 9999 covers the primary 'Add to cart' button on mobile-width layouts. The agent's snapshot shows the button as present and enabled, issues browser_click, and gets 'element intercepts pointer events' — then retries the identical action until the step budget expires, because nothing in its observation explains the failure.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
