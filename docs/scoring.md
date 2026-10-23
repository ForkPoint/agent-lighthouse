# Scoring

A scan produces one number from 0 to 100, or no number when it saw too little. This page traces that number from one audit result to the headline. The code is in [`scorer.ts`](../packages/core/src/scorer.ts) and [`orchestrator.ts`](../packages/core/src/orchestrator.ts); where this page and the code disagree, the code is right.

## The weight law

An audit's weight is a function of its **evidence grade** and **tier**, both set by its dossier. Nobody hand-sets a weight.

```ts
export function weightForGrade(grade: EvidenceGrade, tier: AuditTier): number {
  if (tier !== "scored") return 0;
  return grade === "A" ? 1.0 : grade === "B" ? 0.6 : 0;
}
```

| Tier           | Grade A | Grade B | Grade C | Grade D |
| :------------- | :------ | :------ | :------ | :------ |
| `scored`       | 1.0     | 0.6     | 0       | 0       |
| `informative`  | 0       | 0       | 0       | 0       |
| `experimental` | 0       | 0       | 0       | 0       |
| `obsolete`     | 0       | 0       | 0       | 0       |

Only grades A and B in the `scored` tier move a score. The weight in a report is the weight the scorer used.

## Evidence grades

Each dossier under [`docs/evidence/`](./evidence/) assigns a grade, following the [evidence policy](./evidence/policy.md):

| Grade | Bar                                                                                                 |
| :---- | :-------------------------------------------------------------------------------------------------- |
| **A** | A vendor documents that a named agent reads the signal, or a ratified standard has known consumers. |
| **B** | A draft standard with real adoption, or strong empirical evidence of an effect.                     |
| **C** | A community convention with no proven consumer.                                                     |
| **D** | Speculative; no known consumer or adoption.                                                         |

A and B are scored. C is informative. D ships as experimental only with an active draft-spec trajectory, or as obsolete when a consumer retired or ignores the thing the audit finds.

<span id="the-three-tiers"></span>

## The tiers

- **`scored`**: counts toward its category with weight 1.0 (A) or 0.6 (B).
- **`informative`**: runs and is reported, with weight 0. It is left out of category scores, the overall score, top passes and fails, recommendations and readiness vitals. `isInformative()` is the one predicate every surface uses.
- **`experimental`**: runs only with `--experimental` (CLI) or `includeExperimental: true` (SDK), and is never scored. See [cli.md](./cli.md#--experimental) and [config.md](./config.md#experimental-audits).
- **`obsolete`**: runs by default and is never scored. It reports `notApplicable` when the site does not publish the retired thing, and `warn` when it does; it never fails. Its result carries a `deprecated` notice of kind `obsolete`, with the source and, where one exists, the replacement. Obsolete results are reported in their own section and left out of the category pass, warn and fail counts. `isObsolete()` is the predicate. The JSON report counts them under `conditions.unscored.reasons.obsolete`.

A check in any tier can carry a `deprecated` notice. Its `kind` says which claim it makes: `obsolete` (retired, ignored, or a dead spec), `unconsumed` (live, but no AI vendor documents reading it), or `deprecated` (the audit itself leaves in the next major release; the default when `kind` is absent).

## Category score

| Status | Score | Meaning                                      |
| :----- | :---- | :------------------------------------------- |
| `pass` | 1.0   | The signal is present and correct.           |
| `warn` | 0.5   | Present but incomplete or partly wrong.      |
| `fail` | 0.0   | Absent where required, or broken.            |
| `na`   | —     | Nothing to assess on this site. Not counted. |

```
categoryScore = round( Σ(checkScore · weight) / Σ(weight) × 100 )
```

The sums run over checks that are neither `na` nor informative. A grade-A failure costs about 1.7 times a grade-B failure. A category with no such check is **not assessed**: it shows no score, and its stored `0` means "no data".

`na` is never a pass or a fail. An audit whose precondition is missing returns `notApplicable`, so a site is neither rewarded nor punished for an absent feature.

## Overall score

```
overallScore = round( Σ(categoryScore · assessedMass) / Σ(assessedMass) )
```

A category's **assessed mass** is the summed weight of its checks that reached a scored verdict. Its **registry mass** is the summed weight of every audit registered in it. Registry mass measures coverage; only assessed mass weights the score. So an audit keeps its own weight whichever category it sits in, and a category that was not assessed drops out. With no assessed mass anywhere, the score is 0.

Each category in the JSON report carries `registryMass` and `assessedMass` for the run. The current registry has 223 audits: 166 scored, 48 informative, 2 experimental, 7 obsolete, with a total registry mass of 134.4:

| Category                   | Audits | Scored | Registry mass |
| :------------------------- | -----: | -----: | ------------: |
| Agent Operability & Safety |     48 |     38 |          31.2 |
| Access & Crawl Control     |     37 |     32 |          28.8 |
| Content Extraction         |     27 |     23 |          17.0 |
| Answer Readiness           |     33 |     19 |          13.0 |
| Machine Discovery          |     24 |     16 |          12.8 |
| Agent Interfaces           |     27 |     17 |          12.6 |
| Structured Data            |     14 |     10 |           9.6 |
| Agentic Commerce           |     11 |     11 |           9.4 |

### No score (`overallScore: null`)

A scan only scores what it read. The report sets `overallScore` and `scoreTier` to `null`, with an `unscoredReason`, when:

- the scan never reached the site: connection failure, a bot wall, or a response not attributable to the site;
- the evidence gate removed more than 35% of the registry's scored mass (`GATED_MASS_UNSCORED_THRESHOLD = 0.35`); or
- the scan budget's cut and the gate together left more than 35% unassessed.

Dropping gated audits instead would raise the score of a site nobody could read. Page-type skips are a legitimate absence and do not count toward the threshold.

## Page scope

Common checks use every eligible page. Type-specific checks use pages whose type matches their documented population. `general` pages never carry article obligations.

- A declared page can move a score. A detected page cannot: its type-specific findings stay informative.
- When a scan has both, one top-level result covers the declared pages. Detected findings sit in its `advisoryResults`, as informative. Only the top-level result is scored; never count nested results as extra audits.
- Each result has `coverage`: `provenance` (`all`, `declared` or `detected`), `selectedUrls` (including failed fetches), `inputUrls` (pages handed to the audit), and `unreadUrls` (no readable text, or failed).
- `pageAttempts` records each fetch and whether it parsed. `pagesScanned[].classification` records type, source, confidence and signals.
- A field missing from a saved pre-v7 report means "not recorded", never zero coverage.

### Migration from 6.x

- Replace `content` and `unknown`: editorial pages become `article`, all others `general`. Saved reports with the old names still load, read as `general`.
- Count and score by top-level audit ids. Read nested advisory results separately.
- Treat coverage, classification and attempt fields as optional in saved reports. Never fill them from current detection.
- Invalid page types and malformed override URLs now fail at input on every client.
- Compare scores only across matching versions, page samples and declarations. Changed applicability can move a score without a site edit.

## Score tiers

| Score    | Tier              | Label           |
| :------- | :---------------- | :-------------- |
| 90 – 100 | `agent-ready`     | Agent Ready     |
| 70 – 89  | `partially-ready` | Partially Ready |
| 50 – 69  | `needs-work`      | Needs Work      |
| 0 – 49   | `not-ready`       | Not Ready       |

The [score badge](./badge.md) uses the same bands.

## Readiness vitals

A report also carries four vitals and a `readinessScore`. They are computed apart from the weighted score:

| Vital              | Weight | Averaged over                                                                                            |
| :----------------- | -----: | :------------------------------------------------------------------------------------------------------- |
| `commerce`         |   0.40 | Six audits: offer schema, product identifiers, product details, reviews, services, transaction certainty |
| `content`          |   0.25 | A list of `llms.txt`, sitemap and answer-readiness audits                                                |
| `botAccessibility` |   0.20 | Every applicable Access & Crawl Control check                                                            |
| `technical`        |   0.15 | Every applicable Content Extraction check                                                                |

```
readinessScore = round( commerce·0.40 + content·0.25 + botAccessibility·0.20 + technical·0.15 )
```

A vital is an unweighted mean of its checks' scores. `na` and informative checks are excluded. A vital with no applicable check reads 0, meaning "no data". The id lists are `READINESS_VITAL_IDS` in `orchestrator.ts`.

## Worked example

Five Access & Crawl Control audits, four scored and one informative:

| Audit                                    | Grade | Tier          | Weight | Status | Score |
| :--------------------------------------- | :---- | :------------ | -----: | :----- | ----: |
| `access-crawl-control/gptbot`            | A     | `scored`      |    1.0 | pass   |   1.0 |
| `access-crawl-control/robots-directives` | A     | `scored`      |    1.0 | warn   |   0.5 |
| `access-crawl-control/ai-bot-directives` | B     | `scored`      |    0.6 | fail   |   0.0 |
| `access-crawl-control/no-blanket-block`  | B     | `scored`      |    0.6 | pass   |   1.0 |
| `access-crawl-control/crawl-delay`       | C     | `informative` |    0.0 | fail   |   0.0 |

```
Σ(score · weight) = 1.0·1.0 + 0.5·1.0 + 0.0·0.6 + 1.0·0.6 = 2.1
Σ(weight)         = 1.0 + 1.0 + 0.6 + 0.6                  = 3.2   (assessed mass)
categoryScore     = round(2.1 / 3.2 × 100)                  = 66
```

If the other categories assessed 60.0 mass at a score of 80, the overall score is `round((66·3.2 + 80·60.0) / 63.2) = 79`: Partially Ready.
