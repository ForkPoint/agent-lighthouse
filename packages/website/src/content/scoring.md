# Understand your score

Your score summarizes the checks this scan could assess. Use it to find problems and track changes. It is not a prediction of AI traffic, citations, rankings, or completed purchases.

## Read the coverage first

Before you compare numbers, check which pages the scan reached and which checks it could run. A blocked page, missing information, or a time limit can leave gaps.

An unscored result means the scan cannot give a reliable overall number under its rules. It does not mean your website scored zero.

## What each result means

| Result                         | How to read it                                     | What to do                                                   |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ |
| Pass                           | The check met its requirements.                    | Keep the working setup.                                      |
| Warning                        | The check found a partial issue.                   | Read the finding and decide whether it matters to your site. |
| Fail                           | The check found a problem under its rules.         | Read the suggested fix and its limits.                       |
| Not applicable or not assessed | The check did not produce a verdict for this scan. | Read the reason. Do not treat it as a pass.                  |

Check the finding's scoring status too. An advisory failure does not reduce your score.

<span id="the-three-tiers"></span>

## Which checks affect the score?

- **Scored checks** can affect the number when they apply and the scan can assess them.
- **Advisory checks** add context without changing the score. Reports also call these `informative`.
- **Experimental checks** run only when you opt in. They do not change the score.

Only checks with sufficient supporting proof can count. Grade A has weight 1.0. Grade B has weight 0.6. Grades C and D have weight 0.

These grades describe the proof behind a check, not a grade for your website. The [evidence policy](../../../../docs/evidence/policy.md) explains the standards.

## Read the score bands with care

| Score  | Report label    |
| ------ | --------------- |
| 90–100 | Agent Ready     |
| 70–89  | Partially Ready |
| 50–69  | Needs Work      |
| 0–49   | Not Ready       |

These are score bands, not certifications. Even a high score does not prove that a particular AI system can use every part of your website.

## Choose what to fix first

1. Resolve access problems that stop the scan from reading important pages.
2. Review relevant scored failures and their priority.
3. Check the proof and limits before adding a file or feature.
4. Run another scan with the same options after your changes.

Keep the website address, page selection, scan options, and tool version with each result. A change in coverage or scoring rules can change the number without a change to the website.

<span id="category-scores-to-the-overall-score"></span>

## How the score is calculated

A pass contributes 1, a warning 0.5, and a failure 0 to its check's weighted result. Advisory and not-applicable results do not enter the calculation.

A category score is the weighted average of its assessed checks, rounded to a percentage.

```text
category score = round(sum(check result × weight) / sum(weight) × 100)
```

The overall score combines category scores using the weight of the checks actually assessed in each category. The code calls this `assessedMass`. A category with no assessed weight does not affect that average.

```text
overall score = round(sum(category score × assessed weight) / sum(assessed weight))
```

The scan also applies coverage rules before publishing an overall number. Missing evidence and a scan that runs out of time can make the result unscored. Read the report's reason rather than substituting zero.

Reports may also include a separate readiness summary. It uses a different calculation. Do not compare it directly with the overall score.

## Check the detailed rules

The [scoring implementation](https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/scorer.ts) defines the averages and weights. The [scan implementation](https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/orchestrator.ts) applies coverage rules.

For a plain-language walkthrough, read [how a scan works](./how-scans-work.md). To start a scan, use the [quickstart](./quickstart.md).
