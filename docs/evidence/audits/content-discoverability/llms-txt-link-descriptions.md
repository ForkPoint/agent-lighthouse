---
audit: content-discoverability/llms-txt-link-descriptions
audit_id: "1.4"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/llms-txt-link-descriptions.ts
slug: llms-txt-link-descriptions
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# llms-txt-link-descriptions (`1.4`)

> content-discoverability · source `llms-txt-link-descriptions.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Link descriptions help AI agents understand what each page covers without visiting it, reducing unnecessary crawling.

## Code review findings (2026-08-20, 11-agent pass)

Measures the fraction of llms.txt links carrying a ': description'. The idea is sound, but it inherits `extractMarkdownLinks()`'s hard rejection of relative URLs, so a spec-conformant llms.txt written exactly like this audit's own `guidance.code` sample scores zero links and warns 'llms.txt contains no markdown links'. That is the framework contradicting its own printed advice.

**Required fix:** In `parser.ts::extractMarkdownLinks`, resolve relative URLs against a passed-in base instead of dropping them (keep the SSRF filter at fetch time, where it belongs). Accept ' — ', ' - ' and next-line indented text as descriptions. Handle `[a](url "title")` and `[a](<url>)`. Then re-tune the ratio thresholds against real llms.txt files, and return notApplicable() when llms.txt is absent.

**False-positive risks:**
- `extractMarkdownLinks()` filters with `if (!/^https?:\/\//i.test(c) …) return;` — every relative link (`- [Home](/): Main landing page`) is discarded. The audit's own recommended snippet uses relative links, so following the fix produces the failure.
- Description capture is `(?::\s*([^\n]+))?` anchored immediately after `)`. The equally common `- [Name](url) — description` and `- [Name](url)\n  description` forms are counted as undescribed, driving a real full-description file below the 0.5 ratio and into FAIL.
- The inline regex `\[([^\]]+)\]\(([^)\s]+)\)` cannot match titled links `[a](url "title")` or angle-bracket URLs `[a](<url>)`; those links vanish from both numerator and denominator, skewing the ratio arbitrarily.
- `clean()` strips trailing `)`/`.`/`]`/`` ` `` from URLs, corrupting legitimate URLs containing parentheses.
- Dedupe by URL means a site that lists the same URL under two sections is counted once, so ratios do not reflect the file's actual content.
- 0.5 and 1.0 ratio cut-offs are arbitrary and undocumented — 49% described is FAIL, 51% is WARN.

**Test gaps:**
- llms.txt using relative links — currently produces a wrong verdict and is untested
- '- [Name](url) — description' dash separator form
- Titled links `[a](url "title")`
- URLs containing parentheses
- Nested/indented list items and numbered lists
- Duplicate URLs across sections

**Overlaps with:** `1.5`, `1.1`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
