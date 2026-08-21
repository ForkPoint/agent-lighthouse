# Migration

## v1 → v2

**18 audits are removed in v2.** They no longer run, no longer appear in any
report, and no longer produce a `CheckResult` under their old id. The 2026-08-21
adversarial evidence review could not find a named consumer for any of them:
either nothing reads the signal, or the only thing that ever did publicly
stopped. Keeping them as informative would have shipped noise with a deprecation
badge attached, so they were deleted outright.

The full rationale — steelmanned claim, why it is not a factor, verdict and
sources, one section per audit, plus the complete research dossiers — lives in
[docs/evidence/sunset/](docs/evidence/sunset/README.md), condensed in
[NOT-A-FACTOR.md](docs/evidence/sunset/NOT-A-FACTOR.md).

Removed ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17, 5.25, 6.12,
6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

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
  renames rather than deletes land in the same file with
  `status: "renamed-in-v2"` and a `to` field.
- `reason` — why. `"not-a-factor"` means the evidence review found no consumer.
- `link` — the anchor on NOT-A-FACTOR.md holding that audit's proof.

Report consumers that key on v1 check ids should look each missing id up here
before treating its absence as a scan failure. Dashboards, alerts and
score-tracking built on a `"removed"` id need to drop that series; there is
nothing to re-point it at.
