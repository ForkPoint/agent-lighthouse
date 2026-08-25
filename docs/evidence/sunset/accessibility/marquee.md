---
audit: accessibility/_a11y
audit_id: "7.22"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: marquee
status: sunset
review_verdict: delete
severity: low
evidence_grade: D
disposition: "removed — sunset 2026-08-21 (v2 taxonomy grading pass)"
reviewed: 2026-08-21
---

# No deprecated presentational elements (`7.22`)

> accessibility · source `_a11y.ts` · review verdict **delete** · evidence grade **D** · disposition: **removed — sunset 2026-08-21 (v2 taxonomy grading pass)**

## What it checks

Deprecated elements like <marquee> and <blink> have undefined semantics and unstable text content for parsers.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `marquee` + `blink`. `<blink>` was removed from every shipping browser by 2013 and `<marquee>` is a vestigial legacy element; on the modern web this audit is `inapplicable` on effectively 100% of scanned pages, so it produces `na` and nothing else. It occupies a slot in a 22-audit category and adds a line of noise to every report without ever discriminating between sites. Additionally its `none: ['is-on-screen']` composition means even a real `<marquee>` that happens to be hidden passes.

**Required fix:** Delete the audit (and the `marquee`/`blink` rules from A11Y_RULES) — it cannot change a verdict on any modern site and its stated rationale is wrong.

**False-positive risks:**
- Practically always `na` — it cannot report a wrong result because it never reports anything, which is precisely the 'no real value' case.
- If it did fire, the `is-on-screen` none-check means a hidden `<marquee>` passes, so even the intended detection is conditional on a visibility model that CSS-stripping has already broken.
- The description's claim ('unstable text content for parsers') is unfounded — `<marquee>`'s text is perfectly stable in the DOM; only its rendered position moves.

**Test gaps:**
- No HTML-level test for this audit; the rules are never exercised with `<marquee>`/`<blink>` markup anywhere in the suite.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** The presence of `<marquee>` or `<blink>` makes an element's text content unstable or its semantics undefined for a machine parser, degrading what an agent reads.

**Grade: D** — the claim is false as stated: a `<marquee>`'s text is ordinary, stable DOM text (only its rendered position animates) and `<blink>` has not rendered in any shipping browser for over a decade; the rule's real basis is WCAG 2.2.2 Pause, Stop, Hide, a human-perception criterion this module explicitly excludes, and no consumer — agent or otherwise — is documented to read this signal.

**Evidence:**
- axe's own rule rationale is human-perception, not parsing: `<marquee>` elements "increase difficulty for users with limited dexterity, and are distracting for users with cognitive or attention deficits", mapped to WCAG 2.2.2 Pause, Stop, Hide (Level A) — https://dequeuniversity.com/rules/axe/4.10/marquee (verified 2026-08-21)
- MDN documents `<marquee>` as deprecated with the advice to use CSS animations plus `prefers-reduced-motion` — an authoring/animation concern, with nothing about parsing or text stability — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/marquee (verified 2026-08-21)
- The accessibility-tree representation agents actually consume carries role, accessible name, ARIA state and text content, none of which is affected by CSS-driven or marquee motion — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Agent tool-chains snapshot and act on the a11y tree by uid/reference, with no notion of animated presentational elements — https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (verified 2026-08-21)

**Counter-evidence:** None found in favour of the audit — the only supporting argument would be that scrolling content is a WCAG Level A failure, which is true but is a human-perception criterion outside this module's charter ("Human-perception rules… are deliberately excluded: a non-human consumer can't perceive them"). This corroborates the code review's `delete` verdict: the audit is `inapplicable` on effectively every modern page and its stated mechanism is unfounded.
