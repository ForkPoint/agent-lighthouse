# Evidence dossiers: public surface design

**Status:** draft for approval
**Date:** 2026-08-24
**Context:** The Astro site publishes all 215 audit dossiers from `docs/evidence/audits/` in place. Those files were written as an internal working record, so the published pages currently carry build-process material that serves no reader and weakens the project's credibility.

## Goal

Every audit page answers one question for a site owner: **why does this audit exist, and who says so?** It answers with a mechanism stated as a falsifiable claim, and with links to the vendor documentation or specification that carries it. Everything that exists to serve the build — QA verdicts, task numbers, implementation notes, review chronology — stops being published.

One file per audit, one file tree, no duplication of prose. The split is expressed in frontmatter and applied by the renderer.

## What the reader sees

The published page, in order:

1. **What it checks** — plain language, no jargon, what the audit looks for on a site.
2. **Why it matters** — the mechanism, stated so it could be proven wrong: which named agent reads which signal, and what changes when the signal is absent. Never "AI systems prefer well-structured sites".
3. **The evidence** — each claim with its source: a vendor document, a ratified standard, or a draft specification with named adopters. Every source carries the date it was last verified.
4. **What the evidence does not cover** — the honest limits. Where a vendor states it ignores the signal, the page says so.
5. **How it scores** — the grade, the tier that grade earns, and the weight that follows.
6. **Example failure** — what a failing site looks like, and the fix.

The page never shows: code review verdicts, severity labels, implementation sketches, deviations, deferred work, merge and rewrite narratives, review chronology, or internal task and plan references.

## Provenance

The project's credibility rests on its sources, not on its authorship. Every published claim traces to a primary document a reader can open and check for themselves. That is the standard the pages must meet, and meeting it is what makes the question of who drafted the summary uninteresting.

Two rules follow:

- **No claim of human authorship, review, or endorsement that did not happen.** No invented reviewer names, no "our research team", no implied institutional review. A discovered false claim would cost more trust than the internal notes ever could.
- **Internal process vocabulary is not published.** Phrases naming the tooling that produced the record — agent-pass counts, adversarial research rounds, plan and task numbers — are working notes. They stay in the repository, where the full record remains public and auditable for anyone who wants it.

The distinction is between *not foregrounding a process* and *misrepresenting it*. The first is ordinary editorial practice. The second is off the table.

## The evidence bar

An audit may be published as **scored** only if its dossier carries all of:

- a mechanism stated as a falsifiable causal claim naming the consumer,
- at least one primary source — vendor documentation, ratified standard, or draft specification with named production adopters,
- a `(verified <date>)` stamp on every source,
- a grade with its reasoning written out,
- recorded counter-evidence, or an explicit statement that a search for counter-evidence found none.

An audit that cannot meet the bar drops to informative, exactly as `POLICY.md` already requires. The rewrite does not invent a new standard; it makes the existing one visible and enforced.

## Mechanism: frontmatter plus a label-aware whitelist

The internal sections are interleaved with the public ones, not appended, so a single divider line cannot separate them without reordering all 215 files.

The renderer therefore publishes a **whitelist**. A whitelist fails closed: a heading nobody anticipated stays unpublished until someone decides otherwise. A blacklist fails open, and the ~40 one-off narrative headings across the corpus guarantee that the next new heading would leak.

Prototyping the whitelist against a real file — `access-crawl-control/agent-governance.md`, 2026-08-24 — showed that heading-level slicing alone is not enough. Three corrections follow.

### The unit is the labelled block, not only the heading

The content the reader needs most is not stored under headings. It sits as **bold labels inside** a section:

```
**Mechanism claim:** Each major AI vendor operates separate robots.txt product tokens …
**Evidence:** OpenAI documents the agent (UA 'ChatGPT-User/1.0' …
**Counter-evidence:** Two independent refutations of the block mechanism …
**Consumers:** ChatGPT-User · **Recommended tier:** informative
```

`Why it matters` and `What the evidence does not cover` — sections 2 and 4 of the page contract — exist only as `**Mechanism claim:**` and `**Counter-evidence:**`. The slicer must therefore address both levels: H2 sections, and labelled blocks within them.

`**Consumers:**` and `**Recommended tier:**` are internal. They are the project's own tier deliberation, and publishing "Recommended tier: informative" beside a scored weight would read as an admission rather than as evidence. They stay withheld, and the contradiction sweep exists to make sure no such mismatch survives to be admitted.

### Later sections supersede earlier ones

56 dossiers carry both `## Evidence` and `## Graded evidence (<date>)`. In `agent-governance` the first is a 30-word placeholder — "No dedicated evidence signal was researched for this audit in the 2026-08-20 pass" — and the second carries the real 547 words. Publishing both would put a disclaimer above the evidence it was superseded by.

Rule: when two sections normalise to the same public name, the one with the later date in its heading wins and the earlier is withheld. Where neither carries a date, the later position in the file wins.

### The intro blockquote is replaced, not filtered

Every dossier opens with a strip like:

```
> crawler-permissions · source `agent-governance.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**
```

Category, source file and grade belong to the reader; review verdict and disposition do not. It cannot be kept or dropped as a unit, so the renderer discards it and emits its own strip from registry metadata, which the page already has in scope. That also fixes the stale category name — this file says `crawler-permissions`, a v1 category that no longer exists.

### The whitelist

Public section names, after normalisation:

- What it checks
- Why it matters — from `**Mechanism claim:**` / `**Mechanism:**` / `## Claimed mechanism`
- Evidence — from `## Evidence` / `## Graded evidence`, later supersedes earlier
- Limits — from `**Counter-evidence:**`
- Scoring
- Example failure

Frontmatter carries only the exceptions:

```yaml
public_extra: ["The GEO-benchmark rebuild"]   # publish this non-default section
public_omit: ["Example failure"]              # withhold a normally-public section
```

Two frontmatter fields become load-bearing and are validated at build time: `evidence_grade` and the audit id. The build fails on a dossier that claims a grade its content cannot support — a scored audit with no source URL, or a source with no verification date.

### Measured effect on the prototype file

`access-crawl-control/agent-governance.md`, 1600 words total: 661 words publish across 3 sections, 939 words withheld across 4. The withheld set is the intro strip, `Code review findings (2026-08-20, 11-agent pass)`, `Pass-rule correction (contradiction sweep, 2026-08-24)` and `Review history`.

## Current state, measured 2026-08-24

Across the 215 shipped dossiers:

| measure | count |
| :--- | ---: |
| cite at least one authority URL | 210 |
| meet the full bar today | 139 |
| lack written grade reasoning | 76 |
| lack recorded counter-evidence | 74 |
| lack `(verified <date>)` stamps | 157 |
| cite no authority URL at all | 5 |
| carry no mechanism statement | 8 |

The five with no authority URL: `access-crawl-control/sensitive-paths`, `agent-interfaces/ai-catalog-metadata`, `agent-interfaces/ai-catalog-urls`, `answer-readiness/about-credentials`, `structured-data/howto-schema`.

## Work streams

**1. Renderer and schema.** Implement the whitelist slice, the two frontmatter override keys, and the build-time validation. Touches the website package and the content config only. No dossier changes.

**2. Section renaming.** The corpus uses `Claimed mechanism`, `Mechanism claim`, `Graded evidence` and `Evidence` for what the reader should meet as `Why it matters` and `Evidence`. Normalise the headings so the whitelist is a short fixed list rather than a growing set of synonyms. Mechanical, scriptable, reviewable as a single diff.

**3. Close the 76 missing grade rationales.** Each needs a written justification for the grade it already carries. Where the justification cannot be written, the grade drops and the tier follows.

**4. Close the 5 unsourced and 8 mechanism-less dossiers.** These need research, not editing. If a primary source cannot be found, the audit becomes informative or is retired.

**5. Verification stamps.** 157 dossiers cite sources without a verification date. `sources.json` already records `accessed` dates for 647 sources; where a dossier's URL matches a registry entry, the stamp can be filled from it. The remainder need a link check.

**6. Contradiction sweep.** Some dossiers record counter-evidence that undermines the audit's own pass rule. `access-crawl-control/agent-governance` is the clearest case: its evidence section states that under RFC 9309's fallback rule a bare `User-agent: *` grants every named agent full access, so the audit's current FAIL on that configuration contradicts the standard it cites. Each such case is either an audit fix or a grade change, and each needs judgement rather than a rule.

**7. Retirement decisions.** Carried from the separate audit-value review: the audits whose own evidence records no known consumer. Publishing a page that says "Consumers: none-known" beside a scored weight of 1.0 is the single most damaging thing the new pages could do, so this stream must land before or with the public launch.

## Sequencing

Streams 1 and 2 are prerequisites and can run together. Stream 7 gates the public launch. Streams 3, 4, 5 and 6 are independent of each other and can proceed in any order, but every audit must clear the bar in stream 3 or drop tier before its page is published as scored.

A staged launch is available if the full sweep runs long: publish the pages for the 139 dossiers that meet the bar today, and hold the rest behind the whitelist until they clear it.

## Decisions (2026-08-24)

1. **`Competitor coverage` is internal.** It reads as market positioning, not evidence, and on a page built to argue mechanism from primary sources it invites the reader to debate rivals instead of checking the sources. Not published.
2. **Each page links to its implementation source on GitHub.** The `source_file` frontmatter field already carries the path, so a technical reader can confirm the audit does what the page claims.
3. **No public per-audit changelog for now.** Every dossier's history is days old and consists of internal build steps. Revisit when there is a change a reader would care about — a grade moving, or a pass rule corrected.

## Execution order

Stream 6, the contradiction sweep, runs first. It is independent of the page redesign and it fixes scores that are wrong on live sites today.

