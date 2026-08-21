# Migration

## v1 final minor → v2

18 audits are deprecated in the final v1 minor and removed in v2. They now run
as informative (weight 0): they no longer affect any category score, the
overall score, recommendations, or top lists, and each carries a notice in the
report linking to the public rationale in
[docs/evidence/NOT-A-FACTOR.md](docs/evidence/NOT-A-FACTOR.md).

The machine-readable map ships with the core package as
`@forkpoint/agent-lighthouse-core/migration-map.json`, keyed by v1 audit id:

    {
      "7.1": {
        "slug": "accessibility/skip-nav",
        "status": "removed-in-v2",
        "reason": "not-a-factor",
        "link": "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#accessibilityskip-nav"
      }
    }

Report consumers: treat `status: "removed-in-v2"` ids as gone in v2 — do not
build dashboards on them. v2 renames the surviving audits to `category/slug`
ids; those entries land in the same file with `status: "renamed-in-v2"` when
v2 ships.
