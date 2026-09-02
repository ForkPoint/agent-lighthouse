---
audit: agent-interfaces/ai-catalog-metadata
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-metadata.ts
slug: ai-catalog-metadata
evidence_grade: B
disposition: "kept — rewritten to ARD §4.2 metadata 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
signals:
  - name: ARD entry metadata read by a discovery client
    grade: B
    domain: agent-tools
sources:
  - hf-discover
  - ard-spec-repo
  - google-ard-announcement
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

The required rework from the [redemption dossier](../../deletions/agent-tools/ai-catalog-metadata.md) is executed: _"require specVersion + host{displayName,identifier} + entries[], and score entry quality on description, tags, capabilities and representativeQueries (the exact keys hf-discover indexes), with updatedAt/trustManifest as optional bonuses. Drop owner/contact/lastUpdated/services entirely."_

**Old pass condition:** all seven of `version`, `name`, `description`, `capabilities`, `owner`, `contact`, `lastUpdated` present at the top level, with `warn` at ≥ 3.5/7. None of `owner`, `contact` or `lastUpdated` appears in any revision of the ARD spec, in the Linux Foundation ai-catalog spec, or in any of the four real manifests checked; `version`/`name`/`description` are the wrong shape (the spec uses `specVersion` and nests display metadata under `host`). A spec-perfect manifest scored 0/7.

**New pass condition:** the file at `/.well-known/ai-catalog.json` parses as an ARD manifest (shared `_ard.ts` reader — `specVersion` + `host` + `entries[]`), `host.displayName` is set (ARD §4.3 requires it), and **every** entry carries a `description` plus at least one of `tags`, `capabilities` or `representativeQueries`.

Those four keys are not a taste judgement: `_entry_haystack()` in hf-discover's `navigation.py` builds its match text from `displayName`, `description`, `tags`, `capabilities` and `representativeQueries`. `displayName` is already mandatory per §4.2, so the four scored here are exactly the optional keys that decide whether a query surfaces an entry at all.

Result states:

- `pass` — host named, every entry indexable.
- `warn` — some entries carry indexable metadata but not all, _or_ `host.displayName` is missing. Under-described entries are named in the message (bounded to five plus a count).
- `fail` — no entry carries any of the four keys: the manifest exists but is invisible to a consumer's search.
- `na` — no ARD manifest is served, or it lists no entries.

Closing the false-positive risks listed above:

- **The triple penalty is gone.** Absence of the manifest is now `na`, not a second `fail` for the same missing file that `ai-catalog-exists` already scores. This is a quality check on a feature the site does not implement, which is the framework's own definition of not-applicable.
- **Presence is no longer confused with quality.** `"description": "   "` and `"capabilities": []` do not count; blank members are dropped from every list field.
- **The arbitrary 4/7 cliff is gone.** The thresholds are now structural — all entries indexable / some / none — rather than a fraction of an invented field count.
- **Fabricated authority is gone.** Nothing is reported as "required" that the ARD spec does not require; `updatedAt` and `trustManifest` are reported as bonuses in the `found` line and never gate the result.

**Field levels.** The two bonus fields are read at exactly the levels the spec defines them, which is not the manifest root: §4.2 lists `updatedAt` ("ISO 8601 timestamp") among an **entry's** optional fields, and `trustManifest` is defined on the **entry** (§4.2, "Verifiable identity and trust metadata") and on the **host** (§4.3, "Optional. Trust metadata for the host"). Neither appears in a root-level schema table, and Weaviate's live manifest carries them per-entry. The audit therefore reports `n/m entries with updatedAt` and credits a `trustManifest` found on the host or on any entry; a root-level copy of either is ignored rather than silently accepted. The code sample places `updatedAt` inside the entry for the same reason.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Source: the [redemption dossier's verdict](../../deletions/agent-tools/ai-catalog-metadata.md) — "redeemed — keep with rewrite (grade B)" — carried verbatim into the [REWORK-TODO entry](../../../../packages/core/src/audits/rework-todo.md). The mechanism is consumer-backed (hf-discover's ranking is driven entirely by manifest metadata richness) but no vendor documents downranking on missing metadata — a consumer simply matches less text. That is grade B, not A. Per the §4 weight law `weightForGrade('B', 'scored') = 0.6`; `scoreDisplayMode` stays `ternary`; `defaultPriority` stays `medium`.

### Deviations

- **`host.identifier` is reported, not required.** The rework note names `host{displayName,identifier}`, but the ARD spec makes only `displayName` mandatory in §4.3 and `identifier` optional. Requiring a `did:web` identifier would fail conformant publishers, so a missing one is surfaced in the `found` line and does not move the status.
- **An entry needs description _and_ one structured facet to count as indexable.** A description alone leaves the entry with prose but no facets to match on; it is treated as under-described (`warn`), not as fully indexable. This is a judgement about hf-discover's haystack, not a spec requirement, and is stated as such in the audit's `expected` string.

## Evidence

### Signal: ARD entry metadata read by a discovery client — grade B (agent-tools)

**Mechanism:** A discovery client picks which catalog entry answers a query by matching text drawn from named entry fields. An entry that omits those fields is therefore present in the manifest and invisible to the query. The manifest lists it, and no search surfaces it.

**Grade: B** — the consuming code is first-party, public and readable, and the fields it matches on are exactly the ones this audit scores. It is not grade A because ARD is a draft (v0.9) rather than a ratified standard, and because the behaviour is documented in a client's source rather than in a vendor statement about a hosted crawler.

**Evidence:**

- Hugging Face ships `hf-discover`, an ARD-compliant client whose navigate mode performs "automatic `.well-known/ai-catalog.json` discovery from a website" and follows federated registries — https://github.com/huggingface/hf-discover (verified 2026-08-24)
- Its navigation code builds the text it matches a query against from five entry fields: `displayName`, `description`, `tags`, `capabilities` and `representativeQueries`. `displayName` is already mandatory under ARD §4.2, so the four this audit scores are exactly the optional keys that decide whether a query surfaces an entry at all.
- ARD §4.1 makes `specVersion`, `host` and `entries` the required top-level fields, and defines `version`, `updatedAt`, `tags`, `metadata` and `trustManifest` as optional enrichment; identity is expressed through `host.identifier` (a DID) and the optional `trustManifest` — https://github.com/ards-project/ard-spec (verified 2026-08-24)
- ARD is a Linux Foundation working-group specification with Google, Microsoft and Hugging Face among its contributors, published 2026-06-17 under Apache 2.0 — https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/ (verified 2026-08-24)

**Counter-evidence:** No crawler is documented to downrank a site for thin catalog metadata. The consequence is mechanical — the client matches less text — rather than a published ranking signal. The hosted Hugging Face server does not fetch arbitrary well-known files at all: "Navigation is intentionally not exposed by the hosted server". The consuming path is therefore a user-driven CLI, not a background crawler. The specification is also a draft and says so. Historically this audit scored an invented field list: `owner`, `contact`, `lastUpdated` and `services`. None of those appears in any revision of the spec, or in any of the four live manifests checked — the ARD conformance example, neon.com, weaviate.io and the Shopware core template. A spec-perfect manifest therefore scored zero until the 2026-08-22 rewrite.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-metadata.md](../../deletions/agent-tools/ai-catalog-metadata.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — rewritten (Plan 4, Task 10): scores ARD §4.2's real metadata keys, `owner`/`contact`/`lastUpdated`/`services` dropped, absence downgraded from `fail` to `na`. Grade **B**, tier `scored`, weight 0.6 — unchanged. `TODO(redeem)` header removed; entry dropped from rework-todo.md.
- 2026-08-22 — review fix (Task 10, round 1): the first cut read `updatedAt` and `trustManifest` at the manifest root, which the ARD schema does not define. Both are now read at their spec-defined levels — `updatedAt` per entry (§4.2), `trustManifest` on the entry (§4.2) or the host (§4.3) — in `_ard.ts`, in the code sample and in the fix guidance, with tests pinning that a root-level copy does not count.
