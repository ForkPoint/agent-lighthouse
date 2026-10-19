---
check: overlay-interception-hazard
title: "Overlay Interception Hazard"
domain: agent-operability
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: headless-browser
scoring_tier: scored
reviewed: 2026-10-19
consumers:
  - Playwright MCP (Microsoft) — `browser_click` calls `locator.click()`, which waits for the element to receive events and fails after the action timeout
  - browser-use — drops elements covered by opaque layers from the element list it gives the model
---

# Overlay Interception Hazard

> Proposed check. Evidence grade **A** for Playwright-driven agents · unique · implementation: `headless-browser`

## What it checks

For each interactive element, whether the element is the hit target at its action point, after it has been scrolled into view. It reports the layer that intercepts the click. Typical interceptors are cookie walls, chat widgets, promo modals, fixed bars and invisible full-viewport click-catchers.

## Claimed mechanism (falsifiable)

Playwright MCP's default click tool calls Playwright's `locator.click()` with no `force` option. Playwright documents that a click waits until the element "receives events", meaning it is "the hit target of the pointer event at the action point". If another element captures the click, Playwright retries and then fails with `TimeoutError`. Playwright MCP's default action timeout is 5000 ms. An element that stays covered at every scroll alignment Playwright tries therefore cannot be clicked by that tool.

Test: scroll the element into view at each alignment Playwright uses (default, `end`, `center`, `start`). At each, call `document.elementsFromPoint()` at the element's centre. If the top hit is neither the element nor a descendant at every alignment, predict a failed click.

## Evidence

- Playwright documents the check: "Element is considered receiving pointer events when it is the hit target of the pointer event at the action point." It also states: "If the required checks do not pass within the given timeout, action fails with the `TimeoutError`." — https://playwright.dev/docs/actionability (verified 2026-10-19)
- Playwright MCP's `browser_click` handler calls `locator.click(options)`, with only `button`, `modifiers` and the action timeout as options. No `force` is passed, so the receives-events check applies. Proof pointer: the `click` tool in `packages/playwright-core/src/tools/backend/snapshot.ts` — https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/snapshot.ts (verified 2026-10-19)
- Playwright MCP's README documents the default mode as "Playwright's accessibility tree, not pixel-based input". It sets `--timeout-action` to "defaults to 5000ms". Coordinate clicks exist only behind `--caps=vision` — https://github.com/microsoft/playwright-mcp (verified 2026-10-19)
- On each retry, Playwright cycles the scroll alignment. Its source says this is done because the default scroll "might not work to scroll from under position:sticky elements that overlay the target element". Each interception is logged as "`<element>` intercepts pointer events". Proof pointer: `_retryPointerAction` in `packages/playwright-core/src/server/dom.ts` — https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/dom.ts (verified 2026-10-19)
- Playwright MCP returns a thrown error to the model as a tool result with `isError: true` and the text `String(error)`. Proof pointer: the `catch` in `packages/playwright-core/src/tools/backend/browserBackend.ts` — https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/backend/browserBackend.ts (verified 2026-10-19)
- browser-use enables `paint_order_filtering` by default, described as "Enable paint order filtering. Slightly experimental." `PaintOrderRemover` marks a node `ignored_by_paint_order` when layers painted above it fully contain it. Layers with a transparent background or opacity below 0.8 do not count as covering — https://github.com/browser-use/browser-use/blob/main/browser_use/dom/serializer/paint_order.py (verified 2026-10-19)
- CSSOM View defines `elementFromPoint()` and `elementsFromPoint()` over boxes "that would be a target for hit testing". It notes that `pointer-events` can exclude an element from hit testing. This is the measurement method, not a consumer — https://drafts.csswg.org/cssom-view/#dom-document-elementfrompoint (verified 2026-10-19)

## Inference, not documented

- Vision-based computer-use agents click screen coordinates, so a click on a covered element would land on the overlay. That follows from browser hit testing. No vendor documents it as a failure mode. Anthropic's and OpenAI's computer-use guides do not mention overlays.
- An agent may recover. Playwright's call log names the interceptor, and Playwright's own tests assert that the error message contains it. A model that reads the error can dismiss the overlay and retry. The cost is at least one failed action. Whether the task then fails is not documented.
- browser-use removes a covered element from what the model sees. That is source behaviour. Whether the agent then fails the task is not measured.

## Counter-evidence and limits

- Playwright already escapes most `position: sticky` overlays by cycling scroll alignments. Its source says "This works in most scenarios." A sticky header is a finding only when it still covers the element at all four alignments. The 2026-08-20 sketch's separate sticky-header and `scroll-margin-top` rule had no consumer and is dropped.
- Anthropic's computer-use guide tells operators to ask a human to confirm "any tasks requiring affirmative consent, such as accepting cookies". A cookie wall that blocks an agent is expected behaviour under that guidance. A blocking consent dialog should be reported as a consent interstitial, not as a defect.
- browser-use does not treat a transparent full-viewport layer as covering. Such a layer still intercepts real clicks. browser-use's behaviour on it is not documented.
- The grade covers Playwright-driven agents. It does not extend to vision-only agents.

## Competitor coverage

Not covered. Chrome Lighthouse's agentic category measures layout shift, which is movement, not coverage. A stable page can have every CTA covered. axe has no occlusion rule.

## Implementation sketch

Needs a headless browser. A static fetch has no layout. The browser snapshots in `ScanOptions.snapshots` carry HTML only, with no geometry, so they cannot be hit-tested either.

After load and a settle delay, enumerate interactive nodes. For each, scroll it into view at each of Playwright's four alignments. At each, read `elementsFromPoint()` at the centre of its box. Flag the element only when an unrelated node is on top at every alignment. Record the interceptor's selector, `position` and `z-index`. Group by interceptor, so one cookie bar reports once with its blocked-element count. Report consent dialogs separately, per the limit above.

Viewport: Anthropic recommends "1280x800 or 1366x768" for web applications and "1024x768 or 1280x720" for general desktop tasks. Test at 1280x800 and one mobile width. (The 2026-08-20 sketch said 1280x720 was Anthropic's recommendation for this use. That was imprecise.)

## Example failure

A promo bar fixed to the bottom of the viewport covers the primary "Add to cart" button at mobile width, at every scroll alignment. Playwright MCP's `browser_click` retries for 5000 ms and fails with a timeout that names the bar. The agent must spend further steps to close the bar before it can buy.

## Scoring

Tier per evidence policy: **scored**. Grade A meets the bar for Playwright-driven agents. Absent overlays are `pass`. A consent dialog is reported, not failed.

## Implementation deviations

- The centre-point test now runs at four scroll alignments instead of one. A single-alignment test over-predicts failure for sticky elements, which Playwright escapes.
- The sticky-header offset rule and the ">25% of viewport" fixed-layer rule are dropped. No source ties either to a consumer.

## Deferred

- No source measures task failure rates caused by overlays for any agent. A measurement study is the missing evidence for vision-only agents.
- The scanner has no headless browser. Until it has one, this stays a proposal.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
- 2026-10-19 — evidence review. Grade A kept, narrowed to Playwright-driven agents. Added the Playwright MCP `browser_click` source and Playwright's `_retryPointerAction` as proof of the consumer path. Added browser-use's `PaintOrderRemover` in place of `enhanced_snapshot.py`, which only reads paint order. Removed the MCP versioning source, which says nothing about overlays. Marked the vision-agent claim as inference. Recorded Playwright's sticky-escape retry and Anthropic's cookie-consent guidance as counter-evidence. Corrected the viewport recommendation. Rewrote the example failure: Playwright's error names the interceptor, so the old claim that "nothing in its observation explains the failure" was false.
