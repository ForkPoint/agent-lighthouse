---
audit: content-discoverability/mobile-friendly
audit_id: "1.18"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/mobile-friendly.ts
slug: mobile-friendly
review_verdict: delete
severity: medium
evidence_grade: unrated
disposition: "proposed: redeem as informative (pending triage)"
reviewed: 2026-08-21
---

# mobile-friendly (`1.18`)

> content-discoverability · source `mobile-friendly.ts` · review verdict **delete** · evidence grade **unrated** · disposition: **proposed: redeem as informative (pending triage)**

## What it checks

A viewport meta tag signals mobile-friendliness. AI crawlers may prioritize mobile-friendly content, and many AI-powered searches originate from mobile devices.

## Code review findings (2026-08-20, 11-agent pass)

Checks for <meta name="viewport">. This is a mobile-SEO artifact with no bearing on how an AI agent ingests a page — LLM crawlers fetch and parse raw HTML and never lay out a viewport. The stated impact ('AI crawlers may deprioritize pages without a viewport meta tag') is pure speculation presented as fact, and since the tag ships in every modern framework template, the check discriminates almost nothing. Cargo-cult SEO in an AI-readiness category.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- `page.meta['viewport']` presence only — value is never inspected, so `content="width=1024, user-scalable=no"` (genuinely non-mobile-friendly) PASSES. The audit does not measure the thing its title claims.
- Conversely, a fully responsive site using CSS-only techniques or serving viewport via a JS-injected tag scores FAIL.
- `extractMetaTags()` overwrites duplicates by name, so a page with two viewport tags is judged on the last one.
- AMP pages, embedded/iframe documents and print-oriented pages legitimately vary and are penalized.
- The name 'mobile-friendly' promises a rendering assessment the code cannot make from a single static meta tag — the displayed conclusion overstates the evidence by a wide margin.

**Test gaps:**
- Viewport with a fixed width / user-scalable=no (currently a false PASS)
- Two viewport tags on one page
- JS-injected viewport
- Any evidence-based test tying viewport presence to an agent-visible outcome

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
