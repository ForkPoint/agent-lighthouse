---
audit: operability-safety/meta-refresh
category: operability-safety
source_file: packages/core/src/audits/operability-safety/meta-refresh.ts
slug: meta-refresh
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
sources:
  - whatwg-declarative-refresh
  - mdn-meta-http-equiv
  - wcag-f41
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
---

# No time-based auto-refresh/redirect (`7.20`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

## What it checks

A <meta http-equiv="refresh"> that reloads/redirects after a delay disrupts an agent mid-read and can trap it in unexpected navigation.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `meta-refresh`. Rare but a real hazard: a timed `<meta http-equiv="refresh">` genuinely changes the document under an agent mid-read, and the check correctly allows delay 0 (instant redirect) via `options: { minDelay: 0, maxDelay: 72000 }`. Cheap, correct, low noise. Keep.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- `excludeHidden: false` with selector `meta[http-equiv="refresh"][content]` — a meta refresh present inside a `<noscript>` block (a legacy no-JS fallback that a JS-capable agent never follows) is still flagged.
- Only the first 3 scanned pages are evaluated; a legacy sub-page with a refresh on a large site is missed while the report reads site-wide.
- Selector is an exact attribute-value match, so `http-equiv="Refresh"` (capital R, valid HTML and case-insensitive in browsers) is not matched → false negative on a real occurrence.
- CSR SPA → the rule is inapplicable, `na`.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with `http-equiv="Refresh"` capitalised (the case-sensitivity miss).
- No fixture with `content="0;url=..."` asserting the allowed instant-redirect pass.
- No `<noscript>`-wrapped fixture.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** A `<meta http-equiv="refresh" content="N;url=…">` with N greater than 0 makes the user agent run the shared declarative refresh steps, then navigate or reload the document N seconds after load, with no input from the visitor. Any agent driving that page loses its document, its element references and its in-progress form state mid-task.

**Grade: A** — declarative refresh is specified in the WHATWG HTML Standard and implemented by every browser an agent drives, making the "the page navigates itself after N seconds" claim a ratified, universally consumed behavior rather than an inference.

**Evidence:**
- WHATWG HTML Standard defines the `refresh` pragma and the shared declarative refresh steps that navigate/reload the document — https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh and https://html.spec.whatwg.org/multipage/document-lifecycle.html#shared-declarative-refresh-steps (both verified 2026-08-21)
- MDN: with a non-negative integer the page "reloads after that many seconds"; followed by `;url=` it "redirects to that URL after the specified delay"; the timer starts after `load`/`pageshow` — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/http-equiv (verified 2026-08-21)
- W3C failure technique F41 records the consequence for time-bounded consumers: "If the time interval is too short… people who are blind will not have enough time to make their screen readers read the page before the page refreshes unexpectedly." It fails SC 2.2.1, 2.2.4 and 3.2.5 — https://www.w3.org/WAI/WCAG22/Techniques/failures/F41 (verified 2026-08-21)
- Agent tool-chains hold element handles across turns. Playwright MCP click and type take an "Exact target element reference from the page snapshot", and chrome-devtools-mcp click and fill take a snapshot uid. Those references do not survive a navigation — https://github.com/microsoft/playwright-mcp and https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (both verified 2026-08-21)

**Counter-evidence:** No vendor agent documentation names meta refresh as an agent failure mode, and the disruption is conditional on the agent still being on the page when the timer fires — a fast single-turn read may finish first. The signal is a navigation behavior, not an accessibility-tree signal, so it sits outside the mechanism that carries the rest of this category. Delay-0 instant redirects are correctly allowed by the audit. As implemented the selector is case-sensitive, so `http-equiv="Refresh"` — valid and case-insensitive in browsers — is missed.
