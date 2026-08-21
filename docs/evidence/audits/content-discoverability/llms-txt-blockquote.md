---
audit: content-discoverability/llms-txt-blockquote
audit_id: "1.2"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/llms-txt-blockquote.ts
slug: llms-txt-blockquote
review_verdict: merge
severity: medium
evidence_grade: unrated
disposition: "proposed: merge (pending triage)"
reviewed: 2026-08-21
---

# llms-txt-blockquote (`1.2`)

> content-discoverability · source `llms-txt-blockquote.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **proposed: merge (pending triage)**

## What it checks

The blockquote summary gives AI agents a one-sentence overview of your site without reading further.

## Code review findings (2026-08-20, 11-agent pass)

Grades one cosmetic property of llms.txt — whether a '> ' line appears somewhere after the H1. This is a formatting sub-clause of the same unproven spec 1.1 checks, scored as its own full-weight audit, and its failure messaging is actively wrong when llms.txt is absent-but-200. Fold into a single 'llms.txt is well-formed' audit together with 1.3.

**Required fix:** Merge into a combined llms.txt structure audit with 1.3. Constrain the blockquote search to the first non-blank line(s) following the H1, accept '>' without a trailing space, share one H1 definition with 1.1, and return notApplicable() (not a critical fail) when llms.txt is absent.

**False-positive risks:**
- `afterH1.some((l) => l.trimStart().startsWith('> '))` scans the ENTIRE remainder of the file, not the lines adjacent to the H1. A blockquote used as a footnote at the bottom of a 400-line llms.txt passes as a 'summary'.
- Requires a literal `'> '` with trailing space — the extremely common `>Summary` (no space, still valid CommonMark) is reported as missing.
- `lines.findIndex((l) => l.trimStart().startsWith('# '))` requires '# ' with a space, while audit 1.1 accepts bare '#'. The two audits disagree about what an H1 is, so one file can pass 1.1 and fail 1.2 with 'No H1 heading found'.
- When /llms.txt returns 200 with an HTML soft-404, no `# ` line exists, so the audit reports 'No H1 heading found in llms.txt' — asserting the file exists and is malformed when it does not exist at all.
- Indented blockquotes inside fenced code blocks count as the summary.

**Test gaps:**
- Blockquote appearing far below the H1 (should not count as a summary but currently does)
- '>Summary' without a space
- H1 written as '#Site' — passes 1.1, fails here
- llms.txt served as an HTML soft-404
- Blockquote inside a fenced code block

**Overlaps with:** `1.1`, `1.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
