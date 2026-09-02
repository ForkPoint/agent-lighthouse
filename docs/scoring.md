# Scoring

Agent Lighthouse turns a scan into one number between 0 and 100. This document explains exactly how that number is produced, from a single audit result up to the headline score, so that any score in a report can be traced back to the checks that caused it.

Everything below is implemented in [`packages/core/src/scorer.ts`](../packages/core/src/scorer.ts), [`packages/core/src/audit-config.ts`](../packages/core/src/audit-config.ts) and [`packages/core/src/orchestrator.ts`](../packages/core/src/orchestrator.ts). Where this page and the code disagree, the code is right — please open an issue.

## The weight law

An audit's influence on a score is not a hand-tuned number. It is a pure function of two things the audit's evidence dossier assigns: its **evidence grade** and its **scoring tier**.

```ts
export function weightForGrade(grade: EvidenceGrade, tier: AuditTier): number {
  if (tier !== "scored") return 0;
  return grade === "A" ? 1.0 : grade === "B" ? 0.6 : 0;
}
```

That is the whole law. Read as a table:

| Tier           | Grade A | Grade B | Grade C | Grade D |
| :------------- | :------ | :------ | :------ | :------ |
| `scored`       | **1.0** | **0.6** | 0       | 0       |
| `informative`  | 0       | 0       | 0       | 0       |
| `experimental` | 0       | 0       | 0       | 0       |

Two consequences worth stating plainly:

- **The tier gate comes first.** An audit with grade A that has been moved to the `informative` tier — a signal that was once scored and has since been demoted — carries weight 0 like every other informative check.
- **Nothing outside grades A and B can move a score.** There is no partial credit for a plausible-but-unproven signal.

The weight is stamped onto every check result at the single place a result is built from its metadata (`Audit.toCheckResult` in [`packages/core/src/audit.ts`](../packages/core/src/audit.ts)), so the weight a report shows is the weight the scorer used.

## Evidence grades

Grades are assigned in each audit's dossier under [`docs/evidence/`](./evidence/) and are governed by the [evidence policy](./evidence/policy.md). In short:

| Grade | Bar                                                                                                                                    |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Documented consumer behaviour — a vendor doc states that a named agent reads the signal — or a ratified standard with known consumers. |
| **B** | A draft standard with meaningful adoption, or strong empirical evidence of an effect.                                                  |
| **C** | A community convention with partial adoption; plausible, but no proven consumer.                                                       |
| **D** | Speculative or invented; no known consumer and no adoption evidence.                                                                   |

The policy also fixes what each grade is allowed to do: A and B are scored, C is informative, D ships only if it has an active draft-spec trajectory and then only as experimental, and D without one is not shipped at all.

## The three tiers

Every registered audit carries exactly one tier.

**`scored`** — the audit contributes to its category score with weight 1.0 (grade A) or 0.6 (grade B). This is the only tier that moves a number.

**`informative`** — the audit runs and its result appears in the report, but its weight is 0 and it is filtered out of every ranking surface: category scores, the overall score, top passes, top fails, recommendations and the readiness vitals. A check is treated as advisory when its `scoreDisplayMode` is `informative`, which is the single predicate `isInformative()` that every surface calls, so the rule cannot drift between packages.

**`experimental`** — the audit is behind a flag. It does not run at all unless the scan is started with `--experimental` (CLI) or `includeExperimental: true` (SDK). When it does run it is reported and never scored. See [cli.md](./cli.md#--experimental) and [config.md](./config.md#experimental-audits).

## From a check result to a category score

Each audit returns one of four statuses, and each status has a fixed score between 0 and 1:

| Status | Score | Meaning                                                                        |
| :----- | :---- | :----------------------------------------------------------------------------- |
| `pass` | 1.0   | The signal is present and correct.                                             |
| `warn` | 0.5   | The signal is present but incomplete or partially wrong.                       |
| `fail` | 0.0   | The signal is absent or broken.                                                |
| `na`   | —     | The audit's precondition does not exist on this site. Excluded from the score. |

A category score is the weighted mean of its assessable checks, expressed as a percentage:

```
categoryScore = round( Σ(checkScore · weight) / Σ(weight) × 100 )
```

where the sum runs over checks that are neither `na` nor informative. If the total weight is zero — every check was advisory, or the category had nothing assessable — the category scores 0, which is the "no data" value used consistently across the codebase.

Because weights are 1.0 and 0.6, a grade-A failure costs roughly one and two-thirds as much as a grade-B failure in the same category.

## Not applicable is not a failure

An `na` result leaves the denominator entirely. It is neither a pass nor a fail: nothing was there to assess, so nothing moves.

This matters more than it sounds. A vacuous `pass()` would reward a site for not having a feature; a `fail()` would punish a site for the same absence. Both are wrong, so audits that find their precondition missing return `notApplicable()` instead.

The same rule is applied one level up. A category in which _every_ check came back `na` — Agentic Commerce on a site with no checkout, for example — drops out of the overall score's numerator and denominator together. Without that rule, a blog paid the full agentic-commerce evidence mass at score 0 and was scored down for not being a shop.

## Category scores to the overall score

The overall score is the mean of the category scores weighted by **evidence mass**:

```
overallScore = round( Σ(categoryScore · mass) / Σ(mass) )
```

A category's evidence mass is simply the sum of the weights of the audits registered in it (`CATEGORY_MASS`). There are no hand-assigned category percentages. A category earns influence over the headline score by carrying proven audits, which means:

- Moving an audit from one category to another moves its mass with it, and nothing else changes.
- A category built entirely from informative and experimental audits has mass 0 and cannot move the overall score at all.
- A category with mass, but with no assessable check in this particular scan, is skipped for that scan.

If no category has any mass, the overall score is 0.

### Evidence mass in the current registry

The mass distribution is derived from the registry, not written down anywhere, so it shifts whenever audits are added, re-graded or moved. As of the current registry — 215 audits, of which 164 are scored, 48 informative and 3 experimental — the total mass is 134.0 and it is distributed like this:

| Category                   | Audits | Scored | Mass | Share of the overall score |
| :------------------------- | -----: | -----: | ---: | -------------------------: |
| Agent Operability & Safety |     46 |     39 | 32.2 |                     24.0 % |
| Access & Crawl Control     |     37 |     32 | 29.2 |                     21.8 % |
| Content Extraction         |     27 |     23 | 17.0 |                     12.7 % |
| Answer Readiness           |     33 |     19 | 13.0 |                      9.7 % |
| Machine Discovery          |     24 |     15 | 12.2 |                      9.1 % |
| Agent Interfaces           |     24 |     16 | 12.0 |                      9.0 % |
| Structured Data            |     14 |     10 |  9.6 |                      7.2 % |
| Agentic Commerce           |     10 |     10 |  8.8 |                      6.6 % |

Every scan reports the live figure rather than this snapshot: each category in the JSON report carries its own `weight`, which is its evidence mass for that run.

### The evidence gate and unscorable scans (`overallScore: null`)

A scan judges a site from what the fetch phase returned. If the fetch phase never reached the site (e.g., connection refusal, network error, or a bot defense wall) or received a degenerate response, the scanner must not invent a score from an unread run.

When missing scan evidence causes audits to be gated out, dropping those audits from the denominator would artificially inflate the score of a site nobody could read (for example, a bot wall or empty shell scoring 70+ while real stores score 50–60).

To prevent this distortion, the scorer monitors **gated mass share** (`gatedMassShare` in `packages/core/src/scorer.ts`):

- `GATED_MASS_UNSCORED_THRESHOLD = 0.35` (35% of total registry evidence mass).
- If the share of evidence mass gated out by missing evidence exceeds 35%, the scan is declared **unscorable**: `overallScore` is set to `null` (with tier label `unscorable`) rather than an artificial numerical score.
- Legitimate domain absence (such as page-type skips on a site with no blog or storefront) does not count toward the threshold; only mass withheld by the evidence gate is counted.

## Score tiers

The headline score is also labelled, using fixed bands:

| Score    | Tier              | Label           |
| :------- | :---------------- | :-------------- |
| 90 – 100 | `agent-ready`     | Agent Ready     |
| 70 – 89  | `partially-ready` | Partially Ready |
| 50 – 69  | `needs-work`      | Needs Work      |
| 0 – 49   | `not-ready`       | Not Ready       |

These bands are also what the [score badge](./badge.md) colours itself by.

## Readiness vitals

Alongside the overall score, a report carries four **readiness vitals** and a `readinessScore` derived from them. They answer a different question — "how ready is this site in each of four practical areas?" — and they are computed separately from the weighted score above.

| Vital              | Weight in `readinessScore` | Averaged over                                                                                                                                   |
| :----------------- | -------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `commerce`         |                       0.40 | Six named audits covering offer schema, product identifiers, advanced product details, review schema, service schema and transaction certainty. |
| `content`          |                       0.25 | A named list of `llms.txt`, sitemap and answer-readiness audits.                                                                                |
| `botAccessibility` |                       0.20 | Every applicable check in the Access & Crawl Control category.                                                                                  |
| `technical`        |                       0.15 | Every applicable check in the Content Extraction category.                                                                                      |

```
readinessScore = round( commerce·0.40 + content·0.25 + botAccessibility·0.20 + technical·0.15 )
```

Two differences from the category scoring above are deliberate:

- A vital is an **unweighted** mean of its checks' scores. Evidence mass does not enter here; each contributing check counts once.
- `na` and informative checks are excluded, exactly as in category scoring. A vital with no applicable checks reads as 0, meaning "no data" — the same neutral value the report view-model and the scan summary substitute for an absent vital. Awarding 100 for zero evidence was rejected, because it would inflate the headline of any site that simply has nothing to measure.

The audit id lists behind `commerce` and `content` live in `READINESS_VITAL_IDS` in [`packages/core/src/orchestrator.ts`](../packages/core/src/orchestrator.ts), and a test asserts that every id in them still resolves to a registered audit.

## A worked example

Take five real audits from Access & Crawl Control — four scored, one advisory:

| Audit                                    | Grade | Tier          | Weight | Status | Score |
| :--------------------------------------- | :---- | :------------ | -----: | :----- | ----: |
| `access-crawl-control/gptbot`            | A     | `scored`      |    1.0 | pass   |   1.0 |
| `access-crawl-control/robots-directives` | A     | `scored`      |    1.0 | warn   |   0.5 |
| `access-crawl-control/ai-bot-directives` | B     | `scored`      |    0.6 | fail   |   0.0 |
| `access-crawl-control/no-blanket-block`  | B     | `scored`      |    0.6 | pass   |   1.0 |
| `access-crawl-control/crawl-delay`       | C     | `informative` |    0.0 | fail   |   0.0 |

The informative check is dropped before anything is summed. The rest give:

```
Σ(score · weight) = 1.0·1.0 + 0.5·1.0 + 0.0·0.6 + 1.0·0.6 = 2.1
Σ(weight)         = 1.0 + 1.0 + 0.6 + 0.6                  = 3.2
categoryScore     = round(2.1 / 3.2 × 100)                  = 66
```

If this category carried mass 30.2 out of a total of 139.4, and every other category scored 80, the overall score would be `round((66·30.2 + 80·109.2) / 139.4) = 77` — Partially Ready.

## Where to look in the code

| Question                                    | File                                                                        |
| :------------------------------------------ | :-------------------------------------------------------------------------- |
| The weight law and both score aggregations  | [`packages/core/src/scorer.ts`](../packages/core/src/scorer.ts)             |
| Status → score, and where weight is stamped | [`packages/core/src/audit.ts`](../packages/core/src/audit.ts)               |
| Evidence mass per category                  | [`packages/core/src/audit-config.ts`](../packages/core/src/audit-config.ts) |
| Score-tier bands and vital weights          | [`packages/core/src/constants.ts`](../packages/core/src/constants.ts)       |
| Readiness vitals                            | [`packages/core/src/orchestrator.ts`](../packages/core/src/orchestrator.ts) |
| What a grade is allowed to do               | [`docs/evidence/policy.md`](./evidence/policy.md)                           |

See also: [cli.md](./cli.md) for running a scan and asserting on its score in CI, and [config.md](./config.md) for narrowing a scan to specific categories.
