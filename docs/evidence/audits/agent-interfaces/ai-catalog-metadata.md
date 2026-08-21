---
audit: agent-interfaces/ai-catalog-metadata
audit_id: "5.8"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-metadata.ts
slug: ai-catalog-metadata
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-catalog-metadata (`5.8`)

> agent-tools · source `ai-catalog-metadata.ts` · review verdict **delete** · evidence grade **B** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

Complete metadata helps AI agents understand who owns the service, when it was last updated, and what it can do. Missing fields reduce agent confidence in your services and may cause them to skip your site in favor of better-documented alternatives.

## Code review findings (2026-08-20, 11-agent pass)

Quality check on the invented file from 5.7, grading it against an equally invented required-field list. Adds a second and third automatic zero for the same nonexistent file, and its 'missing most metadata' failure implies a real standard is being violated when none exists.

**Required fix:** Delete along with 5.7 and 5.9.

**False-positive risks:**
- Hard `fail` when the file is absent (line 50) — a second zero charged for the identical absence already charged by 5.7, tripled once 5.9 also fails. One missing nonexistent file produces three failures.
- The seven 'required' fields (version, name, description, capabilities, owner, contact, lastUpdated) are asserted by no specification. Reporting them as 'required' is fabricated authority.
- `parsed[f] !== undefined && !== null && !== ''` counts `"capabilities": []` and `"owner": " "` as present — presence, not quality.
- `present.length >= requiredFields.length / 2` gives warn at exactly 4/7, an arbitrary cliff with no grounding.

**Test gaps:**
- No test that whitespace-only or empty-array field values are rejected
- No test of the triple-penalty interaction with 5.7/5.9

**Overlaps with:** `5.7`, `5.9`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-metadata.md](../../deletions/agent-tools/ai-catalog-metadata.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
