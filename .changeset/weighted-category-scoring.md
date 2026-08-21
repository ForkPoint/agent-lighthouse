---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Weighted category scoring, plus the gatherer helpers the v2 audits are built on.

**Breaking: a category score is now a weighted mean, not a flat average.**

`calculateCategoryScore` previously averaged the `score` of every applicable check equally. It now weights each check by the `weight` declared in its audit meta:

```
score = Σ(check.score × check.weight) / Σ(check.weight)
```

Not-applicable checks (`status === 'na'`) stay out of the denominator, as before. What changed is that evidence strength now moves the number: A-tier audits carry weight `1.0`, B-tier `0.6`, and informative-tier `0` — reported as evidence but deliberately unable to move a score. **Expect published scores to shift for the same site**; they are not comparable to scores from a previous release.

Two consequences worth calling out for anyone constructing `CheckResult` objects directly rather than via `Audit`:

- A check with no `weight` contributes nothing to either side of the ratio. A category whose checks all lack a weight totals zero weight and scores `0`.
- `AuditMetaSchema.weight` now accepts `0` (it required a positive number before), which is what makes the informative tier expressible.

**New in `CheckResult`:** an optional `weight` field, stamped from `AuditMeta.weight` when the audit produces the check, so a consumer can see the weight that scoring actually applied.

**New in `FetchOptions`:** a `userAgent` option that overrides the default scanner User-Agent for a single request — used to probe a site as a specific AI crawler.

**Newly exported gatherer helpers**, previously internal:

- `./gatherers/fetch-classify` — `classifyFetch`, `isRealFile`, `stripBom`, `normalizeNewlines`, and the `FetchClass` / `ExpectedKind` types. Classifies a fetched root file as `ok`, `soft-404`, or `error` from body evidence rather than trusting status 200.
- `./gatherers/robots` — `parseRobots`, `matchesUserAgent`, `groupsForBot`, `isPathAllowed`, `isBlanketBlocked`, and the `RobotsRule` / `RobotsGroup` types.
- `./gatherers/bot-probe` — `probeAsBot` and `BotProbeResult`, for detecting edge blocking that targets AI crawler user agents.
- `./gatherers/pages` — `pagesOfType`, `judgePages`, and `PageJudgement`, for judging every crawled page instead of generalizing from the first one.
- `topLevelJsonLd` and `allJsonLdNodes` — JSON-LD traversal with an explicit depth contract. `topLevelJsonLd` expands arrays and `@graph` while propagating `@context`, but does not hoist nested property objects; `allJsonLdNodes` walks the whole graph for audits that legitimately search deep.
