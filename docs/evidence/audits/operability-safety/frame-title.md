---
audit: operability-safety/frame-title
category: operability-safety
source_file: packages/core/src/audits/operability-safety/frame-title.ts
slug: frame-title
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - mdn-iframe
  - axe-frame-title
  - w3c-html-aam
  - w3c-accname-11
  - probe-aria-snapshot-images
  - chrome-devtools-mcp-tools
---

# Frames are titled (`7.19`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Agents need a title to understand what each iframe contains. Untitled or duplicate-titled frames are opaque embedded contexts.

## Code review findings (2026-08-20, 11-agent pass)

Bundles `frame-title` + `frame-title-unique`. Agent value is thin — an agent generally cannot drive a cross-origin iframe regardless of its title — and the practical failures come from third-party embeds the site owner cannot edit. Worse, `frame-title-unique` is `reviewOnFail: true`, so it inherits the same swallowed-incomplete defect as 7.14: a duplicate frame title is converted to incomplete and then overridden to PASS by `frame-title` passing in the same audit.

**Required fix:** Apply the same aggregation fix as 7.14 (incomplete must beat pass, and reviewOnFail rules must carry their offending nodes). Additionally exclude cross-origin third-party iframes (src host ≠ scanned host) from the fail path, or report them as a separate informational note, since the owner cannot remediate them.

**False-positive risks:**
- Third-party embeds: ad/analytics/chat-widget iframes in the static HTML that ship without a title fail the audit against a site owner who cannot change the vendor markup.
- Guaranteed same-audit swallowing: `frame-title` pass + `frame-title-unique` incomplete → `sawIncomplete && !sawPass` is false → reported as PASS. Duplicate frame titles are never surfaced.
- GTM/Facebook noscript iframes are excluded only because they carry inline `style="display:none;visibility:hidden"`; a site that hides them via a CSS class instead is failed (CSS blindness).
- JS-injected iframes (YouTube facade players, Stripe Elements, maps) are absent from static HTML → `na` on precisely the frames an agent might need to act on.
- Priority is 'low', which is right, but the failure text is identical to the high-priority audits.

**Test gaps:**
- No HTML-level test for this audit.
- No duplicate-frame-title fixture (the swallowed-incomplete defect is untested).
- No third-party-embed fixture.
- No fixture with a title supplied via `aria-label` on the iframe.

**Overlaps with:** `7.14`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** The `title` attribute supplies an `<iframe>`'s accessible name, so an agent reading the accessibility tree sees `iframe "Checkout payment form"` instead of an anonymous `iframe` node and can choose which embedded context to enter.

**Grade: C** — the name computation and the screen-reader consumer are ratified and documented, but the agent-side dependence is unproven. The documented agent snapshot tools address elements by per-element reference or uid, and neither documents frame titles as part of what the model reads. An agent can also read a frame's contents directly rather than choosing frames by name.

**Evidence:**
- MDN: "People navigating with assistive technology such as a screen reader can use the `title` attribute on an `<iframe>` to label its content… Without this title, they have to navigate into the `<iframe>` to determine what its embedded content is" — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe (verified 2026-08-21)
- axe rule maps this to WCAG 4.1.2 Name, Role, Value (Level A) with impact "serious"; the stated consumer is screen reader users, who "can access a list of all frame titles on a page" — https://dequeuniversity.com/rules/axe/4.10/frame-title (verified 2026-08-21)
- HTML Accessibility API Mappings, which specifies the `title`-to-accessible-name mapping for frame elements, is still a W3C Working Draft (05 August 2026) — https://www.w3.org/TR/html-aam-1.0/ (verified 2026-08-21)
- Accessible Name and Description Computation 1.1 (W3C Recommendation) defines the `title`-attribute fallback step in the name computation — https://www.w3.org/TR/accname-1.1/ (verified 2026-08-21)

**Counter-evidence:** Playwright's ARIA snapshot documentation covers roles, names, values and text content but never mentions frames — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21) — and the Chrome DevTools MCP tool reference contains no iframe handling in its snapshot description, only per-element uids — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21). The listed consumer is a human using a screen-reader frame list, a navigation affordance an agent does not need: it receives the frame's contents (or a per-frame reference) directly. Cross-origin third-party embeds — the dominant real-world failure — are unremediable by the site owner and undriveable by the agent regardless of their title, so the signal cannot change the agent outcome there.
