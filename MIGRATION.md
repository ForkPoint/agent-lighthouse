# Migration

## v1 → v2

**26 audits are removed in v2** — 18 in the first sunset wave, 8 more from the
2026-08-21 grading pass. They no longer run, no longer appear in any report, and
no longer produce a `CheckResult` under their old id. The 2026-08-21
adversarial evidence review could not find a named consumer for any of them:
either nothing reads the signal, or the only thing that ever did publicly
stopped. Keeping them as informative would have shipped noise with a deprecation
badge attached, so they were deleted outright.

The full rationale — steelmanned claim, why it is not a factor, verdict and
sources, one section per audit, plus the complete research dossiers — lives in
[docs/evidence/sunset/](docs/evidence/sunset/README.md), condensed in
[NOT-A-FACTOR.md](docs/evidence/sunset/NOT-A-FACTOR.md).

Removed ids: 1.18, 1.21, 1.23, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17,
5.25, 6.12, 6.16, 7.1, 7.22, 8.5, 8.6, 8.14, 8.15, 8.16, 8.17, 8.19, 8.20, 8.21,
10.12.

### What moves

Every category score, the overall score, and the readiness vitals can come out
different for the same site — the removed checks are gone from the denominators.
Recommendations and top-fix/top-pass lists no longer surface them either.

### The machine-readable map

The map ships with the core package as
`@forkpoint/agent-lighthouse-core/migration-map.json`, keyed by v1 audit id:

    {
      "7.1": {
        "slug": "accessibility/skip-nav",
        "status": "removed",
        "reason": "not-a-factor",
        "link": "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/NOT-A-FACTOR.md#accessibilityskip-nav"
      }
    }

Semantics:

- `slug` — the audit's `category/name` identity in v1.
- `status` — `"removed"`: the check is gone, with no replacement. Ids that v2
  keeps land in the same file with `"renamed"` or `"merging"` and a `to` field
  (see [Numeric ids are gone](#numeric-ids-are-gone) below).
- `reason` — why. `"not-a-factor"` means the evidence review found no consumer.
- `link` — for a removed audit, the anchor on NOT-A-FACTOR.md holding its proof;
  for a surviving audit, the repo-relative path of its evidence dossier.

Report consumers that key on v1 check ids should look each missing id up here
before treating its absence as a scan failure. Dashboards, alerts and
score-tracking built on a `"removed"` id need to drop that series; there is
nothing to re-point it at.

## Numeric ids are gone

v1 identified every audit by a numeric `major.minor` id (`1.1`, `8.12`) whose
major half encoded the old 10-category taxonomy. Both are gone in v2:

- **Ids are `category/slug`.** `CheckResult.id` is now e.g.
  `machine-discovery/llms-txt-exists` — stable, readable, and independent of
  where the audit sits in any list. Nothing in a v2 report carries a numeric id.
- **The categories are new.** v2 has 8 categories built around what an agent
  actually does with a site: `access-crawl-control`, `content-extraction`,
  `machine-discovery`, `structured-data`, `answer-readiness`,
  `agent-interfaces`, `agentic-commerce`, `operability-safety`. The v1 category
  names (`content-discoverability`, `crawler-permissions`, `meta-tags`,
  `semantic-html`, `technical-readiness`, `answer-engine`, `generative-engine`,
  `agent-tools`, `accessibility`) no longer appear anywhere.
- **Audits moved across categories.** An audit keeping its slug does not mean it
  kept its home: `technical-readiness/fast-response-time` is now scored under
  `content-extraction`, `structured-data/website-search-action` under
  `agent-interfaces`, and so on. Never reconstruct a v2 id by pasting a v1 slug
  onto a guessed category — look it up.
- **Category scores are not comparable.** Category weight in v2 is *evidence
  mass* — the summed weight of the audits registered in that category — so both
  the membership and the denominators changed. Overall scores across the major
  version are not comparable either.

## Translating a v1 id

`migration-map.json` is keyed by the v1 numeric id and carries all 207 of them:
26 removed, 181 carried into v2.

    {
      "1.1": {
        "slug": "content-discoverability/llms-txt-exists",
        "status": "renamed",
        "to": "machine-discovery/llms-txt-exists",
        "link": "docs/evidence/audits/machine-discovery/llms-txt-exists.md"
      },
      "1.2": {
        "slug": "content-discoverability/llms-txt-blockquote",
        "status": "merging",
        "to": "machine-discovery/llms-txt-structure",
        "interim": "machine-discovery/llms-txt-blockquote",
        "link": "docs/evidence/audits/machine-discovery/llms-txt-blockquote.md"
      }
    }

Read it like this:

- **`"renamed"`** — the audit survives one-for-one. `to` is its v2 id, live in
  this release. Re-point the series at `to` and you are done.
- **`"merging"`** — the audit's signal is being folded into another audit. `to`
  is the id the signal ends up under. That id may already be registered — most
  merge targets are survivor audits that run in this release — or it may only
  land in a later one, so do not assume `to` is resolvable. `interim` is where
  this audit's check runs *today*; always prefer `interim ?? to` to find the
  audit that is live now. Several v1 ids can share one `to`; when they collapse,
  so do their series.
- **`"removed"`** — nothing to re-point at (see above).
- **`link`** — the audit's evidence dossier in this repo: the claim, the grade,
  the sources. Repo-relative; prefix with
  `https://github.com/ForkPoint/agent-lighthouse/blob/main/` for a URL.

A one-line translation, in JS:

    import map from '@forkpoint/agent-lighthouse-core/migration-map.json';

    const v2IdFor = (v1Id) => {
      const e = map[v1Id];
      if (!e || e.status === 'removed') return null;   // gone, drop the series
      return e.interim ?? e.to;                        // what runs today
    };

The full v1 → v2 table, with the reasoning behind every move, merge and split,
is in [docs/evidence/v2-audit-map.md](docs/evidence/v2-audit-map.md).
