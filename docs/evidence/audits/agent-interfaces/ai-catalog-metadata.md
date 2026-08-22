---
audit: agent-interfaces/ai-catalog-metadata
audit_id: "5.8"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-metadata.ts
slug: ai-catalog-metadata
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewritten to ARD §4.2 metadata 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
---

# ai-catalog-metadata (`5.8`)

> agent-interfaces · source `ai-catalog-metadata.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

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

## The rewrite (Plan 4, Task 10, 2026-08-22)

The required rework from the [redemption dossier](../../deletions/agent-tools/ai-catalog-metadata.md) is executed: *"require specVersion + host{displayName,identifier} + entries[], and score entry quality on description, tags, capabilities and representativeQueries (the exact keys hf-discover indexes), with updatedAt/trustManifest as optional bonuses. Drop owner/contact/lastUpdated/services entirely."*

**Old pass condition:** all seven of `version`, `name`, `description`, `capabilities`, `owner`, `contact`, `lastUpdated` present at the top level, with `warn` at ≥ 3.5/7. None of `owner`, `contact` or `lastUpdated` appears in any revision of the ARD spec, in the Linux Foundation ai-catalog spec, or in any of the four real manifests checked; `version`/`name`/`description` are the wrong shape (the spec uses `specVersion` and nests display metadata under `host`). A spec-perfect manifest scored 0/7.

**New pass condition:** the file at `/.well-known/ai-catalog.json` parses as an ARD manifest (shared `_ard.ts` reader — `specVersion` + `host` + `entries[]`), `host.displayName` is set (ARD §4.3 requires it), and **every** entry carries a `description` plus at least one of `tags`, `capabilities` or `representativeQueries`.

Those four keys are not a taste judgement: `_entry_haystack()` in hf-discover's `navigation.py` builds its match text from `displayName`, `description`, `tags`, `capabilities` and `representativeQueries`. `displayName` is already mandatory per §4.2, so the four scored here are exactly the optional keys that decide whether a query surfaces an entry at all.

Result states:

- `pass` — host named, every entry indexable.
- `warn` — some entries carry indexable metadata but not all, *or* `host.displayName` is missing. Under-described entries are named in the message (bounded to five plus a count).
- `fail` — no entry carries any of the four keys: the manifest exists but is invisible to a consumer's search.
- `na` — no ARD manifest is served, or it lists no entries.

Closing the false-positive risks listed above:

- **The triple penalty is gone.** Absence of the manifest is now `na`, not a second `fail` for the same missing file that `ai-catalog-exists` already scores. This is a quality check on a feature the site does not implement, which is the framework's own definition of not-applicable.
- **Presence is no longer confused with quality.** `"description": "   "` and `"capabilities": []` do not count; blank members are dropped from every list field.
- **The arbitrary 4/7 cliff is gone.** The thresholds are now structural — all entries indexable / some / none — rather than a fraction of an invented field count.
- **Fabricated authority is gone.** Nothing is reported as "required" that the ARD spec does not require; `updatedAt` and `trustManifest` are reported as bonuses in the `found` line and never gate the result.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Source: the [redemption dossier's verdict](../../deletions/agent-tools/ai-catalog-metadata.md) — "redeemed — keep with rewrite (grade B)" — carried verbatim into the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md). The mechanism is consumer-backed (hf-discover's ranking is driven entirely by manifest metadata richness) but no vendor documents downranking on missing metadata — a consumer simply matches less text. That is grade B, not A. Per the §4 weight law `weightForGrade('B', 'scored') = 0.6`; `scoreDisplayMode` stays `ternary`; `defaultPriority` stays `medium`.

### Deviations

- **`host.identifier` is reported, not required.** The rework note names `host{displayName,identifier}`, but the ARD spec makes only `displayName` mandatory in §4.3 and `identifier` optional. Requiring a `did:web` identifier would fail conformant publishers, so a missing one is surfaced in the `found` line and does not move the status.
- **An entry needs description *and* one structured facet to count as indexable.** A description alone leaves the entry with prose but no facets to match on; it is treated as under-described (`warn`), not as fully indexable. This is a judgement about hf-discover's haystack, not a spec requirement, and is stated as such in the audit's `expected` string.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass; the grade comes from the adversarial redemption research below._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-metadata.md](../../deletions/agent-tools/ai-catalog-metadata.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — rewritten (Plan 4, Task 10): scores ARD §4.2's real metadata keys, `owner`/`contact`/`lastUpdated`/`services` dropped, absence downgraded from `fail` to `na`. Grade **B**, tier `scored`, weight 0.6 — unchanged. `TODO(redeem)` header removed; entry dropped from REWORK-TODO.md.
