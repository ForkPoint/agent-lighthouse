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
[not-a-factor.md](docs/evidence/sunset/not-a-factor.md).

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
        "link": "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/not-a-factor.md#accessibilityskip-nav"
      }
    }

Semantics:

- `slug` — the audit's `category/name` identity in v1.
- `status` — `"removed"`: the check is gone, with no replacement. Ids that v2
  keeps land in the same file with `"renamed"` and a `to` field (see
  [Numeric ids are gone](#numeric-ids-are-gone) below).
- `reason` — why. `"not-a-factor"` means the evidence review found no consumer.
- `link` — for a removed audit, the anchor on not-a-factor.md holding its proof;
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
  kept its home: `technical-readiness/https-enabled` is now scored under
  `access-crawl-control`, `semantic-html/image-alt-text` under
  `content-extraction`, `generative-engine/descriptive-urls` under
  `answer-readiness`, and so on. Never reconstruct a v2 id by pasting a v1 slug
  onto a guessed category — look it up.
- **Category scores are not comparable.** Category weight in v2 is _evidence
  mass_ — the summed weight of the audits registered in that category — so both
  the membership and the denominators changed. Overall scores across the major
  version are not comparable either.

## Translating a v1 id

`migration-map.json` is keyed by the v1 numeric id and carries all 207 of them:
26 `removed`, 181 `renamed`. There is no third status — every id that v2 keeps
has a `to` that is registered and running in this release.

Those 181 `renamed` ids point at only **148 distinct v2 ids**. Renaming is
one-for-one at the id level, not at the audit level: 57 of the v1 ids were
folded into 24 shared targets, so several old series collapse onto one new one.

    {
      "1.1": {
        "slug": "content-discoverability/llms-txt-exists",
        "status": "renamed",
        "to": "machine-discovery/llms-txt-exists",
        "link": "docs/evidence/audits/machine-discovery/llms-txt-exists.md"
      },
      "1.2": {
        "slug": "content-discoverability/llms-txt-blockquote",
        "status": "renamed",
        "to": "machine-discovery/llms-txt-structure",
        "link": "docs/evidence/audits/machine-discovery/llms-txt-structure.md"
      },
      "1.3": {
        "slug": "content-discoverability/llms-txt-sections",
        "status": "renamed",
        "to": "machine-discovery/llms-txt-structure",
        "link": "docs/evidence/audits/machine-discovery/llms-txt-structure.md"
      }
    }

`1.2` and `1.3` are a fold: two v1 checks, one v2 audit
(`machine-discovery/llms-txt-structure`), and therefore one series from here on.

Read it like this:

- **`"renamed"`** — `to` is the audit's v2 id, live in this release. Re-point the
  series at `to` and you are done. Check whether any of your other v1 ids resolve
  to the same `to` before you assume the series are independent.
- **`"removed"`** — nothing to re-point at (see above).
- **`link`** — the audit's evidence dossier in this repo: the claim, the grade,
  the sources. For `renamed` entries it is repo-relative — prefix with
  `https://github.com/ForkPoint/agent-lighthouse/blob/main/` for a URL. For
  `removed` entries it is already an absolute URL.

A one-line translation, in JS:

    import map from '@forkpoint/agent-lighthouse-core/migration-map.json';

    const v2IdFor = (v1Id) => {
      const e = map[v1Id];
      if (!e || e.status === 'removed') return null;   // gone, drop the series
      return e.to;                                     // live in this release
    };

### If you are holding an older copy of the map

Pre-release copies of `migration-map.json` carried a third status, `"merging"`,
for an audit whose signal was scheduled to fold into another audit but had not
been folded yet. Those entries also carried an `interim` field naming the id
that was still running under its own name at the time, and the advice was to
read `interim ?? to`.

**Both are extinct in the shipped map**: the folds are done, no entry has
`status: "merging"`, and no entry has an `interim` field. `interim ?? to` still
evaluates correctly against the shipped map — `interim` is simply always absent —
so code written against the older guidance keeps working; it is just carrying a
branch that can no longer be taken. A test in `packages/core` fails the build if
either ever reappears.

The full v1 → v2 table, with the reasoning behind every move, merge and split,
is in [docs/evidence/audit-map.md](docs/evidence/audit-map.md).
