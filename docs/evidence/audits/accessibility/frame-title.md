---
audit: accessibility/_a11y
audit_id: "7.19"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: frame-title
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Frames are titled (`7.19`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
