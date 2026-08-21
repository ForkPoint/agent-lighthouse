---
audit: content-discoverability/llms-txt-sections
audit_id: "1.3"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/llms-txt-sections.ts
slug: llms-txt-sections
review_verdict: merge
severity: low
evidence_grade: unrated
disposition: "proposed: merge (pending triage)"
reviewed: 2026-08-21
---

# llms-txt-sections (`1.3`)

> content-discoverability · source `llms-txt-sections.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **proposed: merge (pending triage)**

## What it checks

H2 sections help AI agents navigate your llms.txt by topic. Without them, agents must scan the entire file linearly.

## Code review findings (2026-08-20, 11-agent pass)

Counts lines matching /^##\s/ in llms.txt. Purely cosmetic: 'has at least one H2' is a trivially satisfiable box-tick with no demonstrated effect on any agent's behaviour, and it is scored at the same full weight as 'sitemap exists'. Same missing-file miscategorisation as 1.2. Merge with 1.2 into one llms.txt structure audit.

**Required fix:** Merge into the combined llms.txt structure audit (with 1.2). Skip fenced code blocks when counting headings, treat 'no H2' as a warn/low at most (or notApplicable for short files), and return notApplicable() when llms.txt is absent.

**False-positive risks:**
- `/^##\s/.test(l.trimStart())` counts H2 lines inside fenced code blocks and inside blockquote-quoted examples, so a file demonstrating llms.txt syntax scores its own examples as real sections.
- A perfectly usable single-topic llms.txt with a flat, well-described link list and no H2 is graded FAIL at medium priority — the spec does not require sections.
- `trimStart()` means an indented `  ## x` inside a list item counts.
- Absent llms.txt returns fail with priority 'critical' rather than notApplicable, adding a third critical entry for one missing optional file.

**Test gaps:**
- '##' inside a ``` fenced block
- '###' / '####' only (no true H2)
- Setext-style H2 ('Section\n---')
- llms.txt absent vs. HTML soft-404 distinction

**Overlaps with:** `1.1`, `1.2`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
