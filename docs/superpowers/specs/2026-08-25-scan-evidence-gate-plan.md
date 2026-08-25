# Scan evidence gate — the plan in plain terms

Companion to [the design](./2026-08-25-scan-evidence-gate-design.md), which
carries the argument, the measurements and the parts that are still open. This
file is the readable version: what is being built, why, and in what order.

The measurement behind every number here is in `scripts/spike/`, and is meant to
be rerun rather than trusted.

## The idea

**A scan must know what it saw before it judges what it found.**

Today every audit runs no matter what came back from the network. If the fetch
obtained nothing, the audit answers anyway — sometimes a fail, sometimes a pass,
never "I could not tell". On a Cloudflare-walled storefront that fetched zero
pages, the scanner emitted 92 verdicts and reported a score of 43. A real store
scored 51 on the same run. Nothing in the output separates them.

Two of those 92 are worth naming, because they are not merely unsupported:

- `operability-safety/no-blocking-captcha` returned **pass** on a site that
  answered with a captcha wall.
- `content-extraction/main-element` returned **pass** on a scan that obtained no
  HTML at all.

A vacuous pass is the score inflation the v2 restructure was supposed to have
removed. It survived, because nobody was checking whether the evidence existed.

So: decide once, before any audit runs, which classes of evidence the scan
actually obtained. An audit that needs evidence the scan lacks does not run. It
reports `notApplicable` and states which evidence was missing.

## What gets built

One new module, `packages/core/src/scan-evidence.ts`. It performs no network
requests and reads only what the fetch phase already produced — the page
contexts, the root files, the WAF verdict.

It answers four questions per scan:

| Requirement | The question | Unmet when |
| :-- | :-- | :-- |
| `origin-reachable` | Did we reach the site at all? | non-2xx, a non-HTML root (PDF, JSON, feed), DNS failure, or a temporary redirect to another host |
| `unblocked-fetches` | Did a firewall or a rate limit stop us? | `wafProtection.isBlocked`, or the homepage returned 429 |
| `rendered-body` | Does the served HTML carry readable text? | `words <= 50 && characters <= 200` |
| `sample-adequate` | Did we obtain a usable page of the type this audit needs? | no fetched, rendered page of that type |

The skip machinery already exists and is reused rather than rebuilt.
`planAudits` (`audit-runner.ts:88`) already skips audits whose
`applicablePageTypes` do not match the crawl, and emits a tagged `na` stub so the
audit stays visible in the report. The gate adds a second reason on the same
path, tagged `skipped:no-evidence`, with the unmet requirement named in the
explanation:

> Not assessed: the scan fetched no pages (Cloudflare returned 403).

The gate lives in `planAudits`, not in the `Audit` base class. A base-class hook
would be optional, and 143 audits are a good demonstration of what optional
means in practice.

## Which audits are gated

Not by category. The first draft assigned requirements per category and the
measurement killed it: four of the eight categories are mixed, so a per-category
rule would have under-gated about 33 audits and over-gated about 21.

```
category                audits reading ctx.pages / total
access-crawl-control                   14 / 39
agent-interfaces                        5 / 26
machine-discovery                      14 / 23
operability-safety                     27 / 48
agentic-commerce                       10 / 10
answer-readiness                       33 / 33
content-extraction                     27 / 27
structured-data                        14 / 14
```

The real predicate is whether the audit reads `ctx.pages` — 143 of 236 do — and
that is a static property of the source, so it can be checked at build time.

Each audit declares `requires` in its meta. A new `scripts/check-requires.mjs`,
sitting beside `check-dossiers.mjs`, greps each audit source and fails the build
when the declaration disagrees with what the code actually reads. The mapping
stays explicit in the file, per this repo's habit, and cannot drift silently when
an audit starts reading something new.

Some audits are deliberately exempt, and the exemptions carry the weight:

- `content-extraction/server-rendered` is **not** gated by `rendered-body`. A
  shell is its subject. If the gate silenced it, a client-rendered site would
  escape the one finding that matters most about it.
- `access-crawl-control` audits are **not** gated by `unblocked-fetches`. Being
  blocked is what they are about.
- `operability-safety/no-blocking-captcha` is exempt for the same reason, and
  separately must stop passing when it meets a wall.

## What happens to the score

Two rules. Both came out of measurement, and one of them reverses what the first
draft claimed.

**A scan that saw nothing reports no score.** Not zero, not 38. Today
`ridge.com` scores 43 and `westontable.com` 37 on scans that fetched zero pages,
while a real store scores 51 — the ranges overlap, so the number misleads.
`overallScore` becomes `number | null`, and the report carries a `scanValidity`
block naming the missing evidence.

Worth being precise about the reasoning, because the first draft got it wrong.
It argued that gating would let a blocked site score 100 by admitting nothing.
Replaying the recorded traces through the real scorer shows the opposite: ridge
falls 43 → 38, westontable 37 → 18. The reason to suppress the score is that it
is meaningless in either direction, not that it is generous.

**A client-rendered shell reports no score either.** Gating a shell raises its
score by 5 to 12 points, because `calculateOverallScore` drops any category whose
checks are all `na` and its evidence mass leaves the denominator
(`scorer.ts:98`). Four categories drop on every shell scan, and `excalidraw.com`
lands at 74 against a real store's 51.

The fix is escalation: when the gated evidence mass passes a threshold fraction
of the registry's total, the whole scan is marked not judgeable and the score is
suppressed. A shell then reports no score plus a critical `server-rendered`
failure, which is the accurate pair of statements.

The threshold is deliberately not written down yet. It comes out of the
calibration run, and a number invented before that run would be a guess wearing a
specification's clothes.

## Order of work

### Step 0 — fix `getMainContentText`

Independent of everything above, and shipping today.

`getMainContentText` (`parser.ts:328`) reads `$('main').first()` whenever any
`<main>` exists, and only falls back to `<body>` when none does. So:

```
                    <main> text   <body> text        shipped verdict
velasca.com            0 chars      194 words   fail "0 words, 0 characters"
hiutdenim.co.uk       49 chars      296 words   fail "7 words, 49 characters"
fashionnova.com      199 chars      117 words   pass "18 words, 202 characters"
```

`velasca.com` has one empty `<main>`. `hiutdenim.co.uk` has four. Both are told,
at critical priority, that they serve no content. `fashionnova.com` passes by two
characters, which is a coin flip rather than a verdict.

Across the 100-store benchmark, `content-extraction/server-rendered` fails five
stores and two of those five fails are false.

Fix: measure text over `<body>` minus `script`, `style`, `noscript` and
`template`; prefer `<main>` only when it actually holds text. Rerun the benchmark
and record how many verdicts move. Own changeset, `major` — a scan's output
changes.

### Steps 1–6 — the gate

1. **`scan-evidence.ts` and its tests, wired to nothing.** No behaviour change.
   Reviewable on its own.
2. **Put `evidence` on `CheckContext`, required rather than optional.** An
   optional field fails open, and a caller that forgets is exactly the
   silent-nothing bug this exists to remove. The cost was measured before the
   decision: 224 of the 231 audit test files build their context through a shared
   `mockCheckContext`, so the field is added once. Eight files build one by hand
   and take `allEvidenceMet()` explicitly.
3. **`server-rendered` consumes the gate's verdict** instead of recomputing it.
   First behaviour change, one audit, easy to reason about.
4. **`requires` on meta, `check-requires.mjs`, and the gate in `planAudits`** —
   behind an option that defaults to off.
5. **Calibration.** 138 stores, gate off and gate on, twice, at
   `--concurrency=2 --delay=3` so the run does not throttle itself and measure
   its own throttling (the mistake behind #18). Stores that disagree between the
   two runs are treated as rate-limit noise, not as data. The run reports gated
   count per store, score delta per store, and every shell decision confirmed by
   hand. Its numbers are written back into the design document, including the
   §7.2 threshold.
6. **Turn it on by default,** together with the score suppression, the
   `recommendations` fix, and the null-score path through report, CLI, MCP and
   the website. One `major` changeset.

Steps 0 through 3 are safe to merge on their own. Step 6 must land whole: a
half-applied score rule is worse than no rule.

## What a reviewer should check

- Step 0 moved the `velasca.com` and `hiutdenim.co.uk` verdicts, and a fixture
  pins the regression.
- No audit is silenced whose subject is the thing that silenced it (§7.4 of the
  design).
- The six test harnesses that build their own `CheckContext` pass
  `allEvidenceMet()` — otherwise small corpus fixtures self-gate and a
  conformance assertion turns into a vacuous `na`, which is a green suite proving
  nothing.
- Calibration numbers are in the design document before step 6 merges, not after.

## What is still unknown

- The shell rule's error rate is measured on 45 sites. That is a sample, not a
  bound.
- `check-requires.mjs` greps for `ctx.pages` and will miss an audit that reaches
  pages through a gatherer helper. It is a ratchet, not a proof.
- The escalation threshold is unset until step 5 runs, so the design is not fully
  specified until then.
- The spike corpus is five shells, two walls, two controls and 43 storefronts,
  Shopify-heavy and English-heavy. Every number inherits that.
