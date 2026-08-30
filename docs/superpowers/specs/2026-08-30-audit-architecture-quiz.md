# Law quiz — explanations and the user's rulings

**Date:** 2026-08-30
**Branch:** `docs/audit-architecture`
**Format:** Claude explains each law from
[`2026-08-30-audit-architecture-design.md`](./2026-08-30-audit-architecture-design.md);
the user rules on whether the explanation is right. User notes are recorded verbatim.

This file is the record of what was ratified, what was rejected, and what the
quiz turned up that the design did not contain. Where a ruling changes a law,
the change is tracked in the "Consequence" row and applied to the design
document separately.

---

## Law 1 — One audit, one file, one dossier

**Claude's explanation.** This is not about tidiness. `scripts/check-dossiers.mjs`
proves agreement in both directions: every registered audit has a dossier whose
`evidence_grade` and `slug` match its meta, every `sources:` id resolves, and no
dossier survives its audit's removal — removed audits move to
`docs/evidence/sunset/`, merged ones to `docs/evidence/merged/`, neither is
deleted. The bidirectionality is the point: a one-way check would let a dossier
drift into fiction after its audit changed grade, and the dossier is what the
public website publishes.

**Ruling.** No option selected. Note given instead.

> the idea is that one file codewise does not mean we are not reausing some
> pre-conditions of library peaces that will be used in all audits, if you like
> we can make a some kind of annotations or cross cutting concerns so there are
> reusable pieces and the actual code of the audit is focusing on the audit
> itself not some boilerplate code for preconditions

**Consequence.** The explanation was not the point. "One audit, one file" must
not be read as "every audit reimplements its own preconditions." Preconditions
are cross-cutting concerns and belong in reusable pieces — annotations,
decorators or guards — so an audit body holds the judgement and nothing else.

This is stronger than the design's law 5. Importing a *constant* is passive: an
audit can import `NO_OPENAPI_SPEC` and still branch wrongly around it. Importing
a *guard that runs* is active, and cannot be satisfied without being obeyed. It
also partly revives the "framework prevents it" option, which the review
rejected on migration cost rather than on soundness.

**Status:** law 1 to be re-drafted. New law needed on precondition reuse.

---

## Law 2 — The grade sets the weight

**Claude's explanation.** Weight is a derived value, never a knob.
`weightForGrade(grade, tier)` gives A → 1.0, B → 0.6, C/D → 0, and
`sunset.test.ts` enforces three consequences: a non-scored tier implies weight 0
and `scoreDisplayMode: 'informative'`; grade C in the scored tier is
unregistrable because `weightForGrade` returns 0 for it; and `tier !== 'scored'`
is equivalent to `weight === 0`. The reason is the top law — weight is how much
a claim moves a score, so it must be a function of how well the claim is
evidenced, never of how important it feels.

**Ruling.** No option selected. Note given instead.

> however this means that grades for audits will drift over time, since some
> adopted specs will become more valuable over time, so a constant research is
> important to be done, we need to stamp when the audit was last validated and
> researched, is the info stale

**Consequence.** The mechanism is not disputed; the missing part is time. A
grade is a claim with a date. Specs gain adoption, vendors document consumers
they previously did not, and a grade earned in one month is not the same claim a
year later.

Measured on this branch: **215 of 216 dossiers carry a `reviewed:` date, and
every one falls in 2026-08-20 to 2026-08-24** — a single research sprint. The
stamp exists, is fully populated, and nothing reads it. No gate, no staleness
threshold, no re-review trigger.

**Status:** law 2 keeps its mechanism and gains a sibling law on warrant
freshness. New debt: the `reviewed:` stamp is unused.

---

## Law 3 — Score only the population the evidence covers

**Claude's explanation.** `applicablePageTypes` is enforced at runtime by
`planAudits`, not in CI, and that is correct rather than a gap. Omitting the
field means "all page types", which is a valid and common declaration — 180 of
215 omit it — so there is nothing a CI check could compare it against without a
second declaration of the same fact. The failure it prevents: a grade earned for
coding agents does not license failing a retail store.

**Ruling.** No option selected. Note given instead.

> i am not ok with this example, the applicable page types were ideal for pages
> of e-commerce improtance like PDP PLP Homepage, but i need to revisit this
> idea in general, maybe generalize the audits for all types of sites
> independent of page type

**Consequence.** Not ratified. The example was wrong, and the concept itself is
under review. `applicablePageTypes` was introduced for e-commerce page classes —
PDP, PLP, homepage — and the open question is whether audits should instead hold
for any site regardless of page type, which would remove the field rather than
gate it.

**Status:** law 3 parked. Open question, not a settled law. Nothing in the
design should assert it until this is decided.

---

## Law 4 — Declare what the scan must have obtained

**Claude's explanation.** `requires` names classes of scan evidence an audit
needs to say anything true — `origin-reachable`, `unblocked-fetches`,
`rendered-body`, `sample-adequate` — and `scripts/check-requires.mjs` compares
that declaration against what the source actually reads. Four audits declare
`requires: []` deliberately and are listed as `GATE_EXEMPTIONS`:
`access-crawl-control/no-redirect-chains`, `no-bot-detection`, `https-enabled`,
and `operability-safety/no-blocking-captcha`. The reason: their subject *is* the
missing evidence. `no-bot-detection` cannot require `unblocked-fetches`, because
a blocked fetch is exactly what it reports on.

**Ruling.** **Correct.**

**Status:** ratified as written.

---

## Running tally

| law | ruling | effect on the design |
|--:|:--|:--|
| 1 | note, not a verdict | re-draft; add a law on precondition reuse |
| 2 | note, not a verdict | keep mechanism, add a freshness law, record the unused `reviewed:` stamp as debt |
| 3 | note, not a verdict | park as an open question; do not assert |
| 4 | correct | ratified |
| 5–10 | pending | — |
