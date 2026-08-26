# Scan evidence gate — design

Status: draft, revised after a measurement spike (§2) that changed four of its
decisions and found one shipped bug; revised again after plan review —
text-metric split (§9 step 0), gatherer-aware `requires` check (§8), escalation
mass defined (§7.2), same-domain geo redirects (§6.1), single 429 retry (§6.2)
Date: 2026-08-25
Area: `packages/core`, with forced changes in `report`, `cli`, `mcp`, `website`

## 1. Problem

A scan judges a site from what the fetch phase returned. Nothing checks whether
the fetch phase actually saw the site. When it did not, the audits run anyway
and each one invents a verdict from an empty or hostile response.

The first draft of this document estimated the damage from reading the code. The
spike measured it instead. On `ridge.com`, behind a Cloudflare 403 wall, the
scanner fetched **zero pages** and still emitted **92 verdicts** — 40 fail, 29
warn, **23 pass** — and reported an overall score of 43. A real storefront,
`allbirds.com`, scored 51 on the same run. Nothing in the output tells the two
apart.

Two of those verdicts are worth naming, because they are not merely
unsupported, they are backwards:

- `operability-safety/no-blocking-captcha` → **pass**, on a site that answered
  with a Cloudflare captcha wall.
- `content-extraction/main-element` → **pass**, on a scan that obtained no HTML.

The shape of the defect: **missing evidence is indistinguishable from a negative
finding, and worse, sometimes from a positive one.** An audit cannot tell "this
site has no `<main>`" from "this scan never obtained this site's HTML", so it
reports whichever its code path reaches first. A vacuous `pass` is the score
inflation the v2 restructure was supposed to have removed.

Three shipped failures share the shape: #18 (the scanner read its own rate limit
as the site's firewall), #17 (five audits returned a plausible `na` on every
storefront they were broken on), and the JS-shell case this spike measured.

**143 of 236 registered audits read `ctx.pages`.** That is the population at
risk, counted, not estimated.

## 2. The spike

Run before designing further, because the first draft was a large architecture
proposed on a hunch. Scripts and raw results are in `scripts/spike/`; every
number below is reproducible with `npx tsx scripts/spike/<name>.ts`.

| Step | Script | What it answered |
| :-- | :-- | :-- |
| 1 | `probe-shells.ts` | Which sites are genuinely client-rendered, by measurement |
| 2 | `spike-scan.ts` | How many audits make a claim with no evidence |
| 3 | `simulate-gate.ts` | What gating those audits does to the score |
| 4 | `probe-stores.ts` | False-positive rate of the shell rule on 43 real storefronts |

### 2.1 What it confirmed

Step 2, over 5 client-rendered sites, 2 WAF-walled sites, 2 controls:

```
site                       pages  page-reading audits: pass  fail  warn   na   score
https://ridge.com              0                        14    26    10    89      43
https://westontable.com        0                        13    26    12    88      37
https://web.telegram.org       1                        22    27    10    80      49
https://excalidraw.com         1                        39    23     9    68      62
https://allbirds.com (ctrl)    6                        51    45    24    19      51
```

A zero-page scan produces 50 claims from audits that read pages. A zero-word
shell produces 59.

### 2.2 What it refuted

**§7.1 of the first draft was wrong in direction.** It argued that gating would
let a site score 100 by blocking the scanner. Step 3 replayed the traces through
the real scorer with all 143 page-reading audits forced to `na`:

```
site                     pages  baseline  gated  delta
https://ridge.com            0        43     38     -5
https://westontable.com      0        37     18    -19
https://excalidraw.com       1        62     74    +12
https://music.youtube.com    1        49     61    +12
https://allbirds.com         6        51     51     +0
```

A blocked site scores **lower** when gated, not higher — the root-file audits
that survive were failing anyway. The real defect at zero pages is not inflation,
it is that 43 and 37 are noise wearing a number's clothes.

Score inflation is real for the **shell** case, at +5 to +12. Small, but it
inverts the ranking that matters: post-gate, `excalidraw.com` (74) outscores
`allbirds.com` (51). §7.2 addresses that, at the size the measurement supports.

### 2.3 What it broke

The `rendered-body` heuristic the first draft specified — low text **and** a
corroborating shell signal — is worse than the plain text threshold it was meant
to improve. It misses `web.telegram.org` (0 words, 0 characters, no framework
root selector, no `<noscript>` warning) and `music.youtube.com`. The plain
threshold caught all five shells and flagged no control. The corroborating
condition was caution that cost recall and bought nothing.

### 2.4 What it found by accident

Step 4 ran the shell rule over the 43 storefronts that answered cleanly in the
benchmark. Six flagged. Three are not shells:

```
                        <main> text   <body> text        shipped verdict
velasca.com               0 chars      194 words   fail "0 words, 0 characters"
hiutdenim.co.uk          49 chars      296 words   fail "7 words, 49 characters"
fashionnova.com         199 chars      117 words   pass "18 words, 202 characters"
```

`getMainContentText` (`parser.ts:328`) reads `$('main').first()` when any
`<main>` exists, and falls back to `<body>` only when none does. `velasca.com`
has one empty `<main>` and 194 words elsewhere. `hiutdenim.co.uk` has **four**
`<main>` elements and the first holds 49 characters.

So `content-extraction/server-rendered` — grade B, scored, **critical**
priority — currently tells real storefronts they serve no content. Across the
100-store benchmark it fails 5 stores, and **2 of those 5 fails are false**.
`fashionnova.com` passes by 2 characters over the threshold, which is a coin
flip, not a verdict.

This is a live user-visible defect, it is independent of the gate, and it is
cheap. It ships first (§9, step 0).

### 2.4.1 What step 0 actually moved (measured 2026-08-26)

Two measurements, because a live re-scan is noisy and the rule change is not.

**Deterministic.** One homepage fetch per store across 20 benchmark
storefronts, 19 of which answered (`bombas.com` returned 429). For each page,
the old metric (`$('main').first()`, `<body>` only when no `<main>` exists),
the new `getMainContentText` (the `<main>` holding the most text, `<body>` only
when none holds any) and the new `getRenderedText` (the whole `<body>`) were
scored against the unchanged `wordCount > 50 || length > 200` threshold.

```
                    <main> count   old metric    new getMainContentText   getRenderedText
hiutdenim.co.uk           4        7w / 49c      135w / 1027c             296w / 2470c
velasca.com               1        0w / 0c       194w / 1142c             194w / 1142c
fashionnova.com           1       28w / 273c      28w /  273c             127w / 1396c
```

**Two of 19 pages change verdict, and both change from a false fail to a
pass**: `hiutdenim.co.uk` and `velasca.com`, for both the main-scope and the
body-scope metric. The other 17 hold their verdict. The three shells stay
shells on every metric — `gymshark.com` at 1 word in the body,
`quitenice.co` at 0, `tattly.com` at 20 words / 127 characters.
`fashionnova.com`, the 2-character coin flip named above, now clears the
threshold by 1,196 characters instead.

**Live re-scan.** The full benchmark was re-run before and after on the same 20
stores; 8 answered cleanly on both runs and were comparable. 26 check verdicts
moved across those 8. Four are attributable to this change:

```
hiutdenim.co.uk   content-extraction/server-rendered    fail -> pass   7 words -> 296 words
velasca.com       content-extraction/server-rendered    fail -> pass   0 words -> 194 words
hiutdenim.co.uk   answer-readiness/specific-numbers     fail -> pass   found £325, £275, £245
velasca.com       answer-readiness/unique-data          fail -> warn   found 10%
```

The remaining 22 are network noise, not code: TTFB moves that flip
`server-responsiveness` (allbirds 693ms -> 5141ms), probe counts that differ
run to run (`ai-crawler-edge-parity`, `agent-ua-commerce-parity`), and pages
that were sampled in one run and not the other. `taylorstitch.com` moving
`content-without-clickthrough` to warn on "39 words" looked like this change
and is not: that page measures 39 words on the old metric and 39 on the new,
and it was simply not in the earlier sample.

Two verdicts move outside `server-rendered`, both from a false fail toward the
truth. That is inside the blast radius this step was allowed.

## 3. Goal

Decide, once per scan and before any audit runs, which classes of evidence the
scan actually obtained. Audits that need evidence the scan does not have are
skipped as `notApplicable` with the reason attached, instead of running blind.

## 4. Non-goals

- No headless browser. The scan stays fetch + parse.
- No new network requests. The gate reads what the fetch phase already produced.
- No change to what any audit *concludes* when its evidence is present.
- Not a replacement for `applicablePageTypes`. That gate stays and runs first.
- Not a soft-404 or consent-wall detector (§11.4).

## 5. Architecture

### 5.1 New module

`packages/core/src/scan-evidence.ts`. Pure: no network, no IO. It reads the
`PageContext[]`, the `rootFiles` map and the `WafProtection` the orchestrator
already has.

```ts
export type EvidenceKey =
  | 'origin-reachable'
  | 'unblocked-fetches'
  | 'rendered-body'
  | 'sample-adequate';

export interface ScanEvidence {
  met: Record<EvidenceKey, boolean>;
  /** One sentence per unmet key, shown in the `na` stub and the trace. */
  reasons: Partial<Record<EvidenceKey, string>>;
  renderedByPage: Record<string, boolean>;
  usablePageTypes: Set<PageType>;
  /** False when no verdict about this site can mean anything (§7.1). */
  judgeable: boolean;
}

export function buildScanEvidence(input: {
  requestedUrl: string;
  homepageResult: FetchResult;
  pages: PageContext[];
  rootFiles: Record<string, FetchResult>;
  wafProtection: WafProtection | null;
}): ScanEvidence;

/** All requirements met. For test harnesses not exercising the gate. */
export function allEvidenceMet(): ScanEvidence;
```

### 5.2 Data flow

1. `runScan` fetches root files and pages. Unchanged.
2. Page contexts are built (`orchestrator.ts:319-357`). Unchanged.
3. `detectWafProtection` runs (`orchestrator.ts:378`). Unchanged.
4. **New:** `buildScanEvidence(...)` runs immediately after.
5. `CheckContext` gains `evidence: ScanEvidence` — **required, not optional**.
   Optional fails open, and a caller that forgets is exactly the silent-nothing
   bug this exists to remove. The cost was measured: 223 of the 231 audit test
   files build their context through `mockCheckContext` (recounted 2026-08-25;
   recount at step 2 — it drifts), so the field is added once in
   `__tests__/test-utils.ts`. Eight files build one by hand and take
   `allEvidenceMet()` explicitly.
6. `planAudits` gains a second skip reason beside `TAG_SKIPPED_PAGE_TYPE`.
7. The report carries the evidence verdict (§7.3).

### 5.3 Skip mechanics

`planAudits` (`audit-runner.ts:88`) already emits an `na` `stubCheck` tagged
`skipped:page-type` and never constructs the audit. The gate reuses that path
with a new tag, `TAG_SKIPPED_NO_EVIDENCE = 'skipped:no-evidence'`.

Order per audit: page-type mismatch first (so no existing wording changes), then
unmet requirements, then runnable. The explanation names the key and its reason:
`Not assessed: the scan fetched no pages (Cloudflare returned 403).`

`sample-adequate` resolves per audit: unmet when none of the audit's
`applicablePageTypes` appears in `usablePageTypes`. An audit with no declared
page types resolves against the homepage.

The gate sits in `planAudits`, not in the `Audit` base class. A base-class hook
is optional, and 143 audits demonstrate what optional means.

## 6. The four requirements

### 6.1 `origin-reachable`

Source: `homepageResult.status`, `.finalUrl`, `.contentType`, `.error`.

Met when the homepage returned 2xx, served `text/html` or
`application/xhtml+xml`, and `finalUrl`'s host matches the requested host —
treating an added or dropped `www.` and an `http:`→`https:` upgrade as the same
host.

The content-type condition catches a PDF, JSON or feed answering at `/`, which
today parses into a nonsense DOM that every content audit then judges.

A cross-host `301`/`308` counts as met, with the final host stamped in the
report: that is a domain migration, and the site the user reached is real. A
`302`/`307` whose target stays inside the same registrable domain (eTLD+1) also
counts as met — `site.com` answering with a hop to `us.site.com` is a geo
router, not a different site, and international storefronts do it on every
request. Only a temporary redirect to a different registrable domain counts as
unmet. The spike corpus is English-heavy and never exercised the geo case, so
the calibration run (§8.3) checks it explicitly.

`quitenice.co` in the spike corpus returned a 114-byte body — a parked or dead
origin. It belongs here, not in `rendered-body`.

**Amended 2026-08-26, from the calibration probe.** The eTLD+1 rule is not
enough. `zalando.com` answers `302 https://www.zalando.bg/` and
`aboutyou.com` answers `302 https://www.aboutyou.bg/...` — every request, from
a European address. Both leave the registrable domain, so the rule as written
marked two real storefronts unreachable and would have left them unscored. A
temporary redirect is therefore also met when the **registrable name** matches
across public suffixes (`zalando` == `zalando`), which is the signal a country
storefront actually gives. It is weaker than matching the domain: two unrelated
companies can share a second-level name under different TLDs. That is accepted,
against the alternative of reporting every ccTLD geo router as unreachable.

### 6.2 `unblocked-fetches`

Source: `wafProtection` and page statuses. Unmet when `wafProtection.isBlocked`,
or the homepage returned 429.

The reason text keeps two cases apart, because #18 exists from conflating them:
`isRateLimit === true` means the scan throttled itself and should retry slower;
any other provider means the site refused the scan.

Asymmetry with `sample-adequate` is deliberate: a scan whose homepage answered
but whose internal pages were refused stays met here and loses those pages
through `sample-adequate`. Blocking is judged at the origin; coverage per page.

A homepage 429 is retried once — after `Retry-After` when present, a fixed
backoff otherwise — before the requirement goes unmet. A 429 is as likely the
scan's own throttle as the site's refusal (#18), and declaring a scan not
judgeable on a self-inflicted signal trades a wrong number for a wrong null.
One retry, no loop; if it also fails, unmet stands and the reason carries
`isRateLimit`. Ships with step 6, because it only matters once suppression is
on.

### 6.3 `rendered-body`

Per page. Met when the served HTML carries text a non-JS consumer can read.

```
met(page) = wordCount > 50 || textLength > 200
```

That is the existing `server-rendered.ts:47` condition, moved into
`scan-evidence.ts` as the single implementation, **with the text metric fixed**
(§2.4): text comes from `getRenderedText` — the whole `<body>` minus
`script`/`style`/`noscript`/`template` — never from the first `<main>`. Step 0
(§9) creates that function and defines the split.

The first draft added a corroborating-signal requirement on top. §2.3 measured
it as strictly worse — it missed two of five real shells and improved nothing.
Dropped.

The `||` is load-bearing and must survive the move. `getWordCount` splits on
whitespace (`parser.ts:342`), so a full Chinese or Japanese page counts a handful
of words; the character branch is what stops the gate silencing every CJK site.
`answer-readiness/direct-definitions` learned this in the v2 rework.

Measured behaviour of this rule: 5 of 5 client-rendered sites flagged, 0 of 2
controls, and after the §2.4 metric fix, 3 of 43 storefronts flagged — all three
(`gymshark.com` 1 word in `<body>`, `tattly.com` 20 words, `quitenice.co` a
114-byte body) confirmed by hand. **Zero known false positives once the metric
is fixed**, on a 45-site sample. That number is the sample's, not a bound.

### 6.4 `sample-adequate`

`usablePageTypes` = page types among pages that were fetched (already filtered
to status 200 with a body at `orchestrator.ts:334`) **and** whose
`renderedByPage` entry is true. Scan-level met when the set is non-empty.

This closes the "1 of 1 page" vacuous verdict: `planAudits` today checks only
that a page of the right type exists, never that its fetch produced anything.

### 6.5 Deliberately not in v1: `root-files-definitive`

A 429 or timeout on `robots.txt` is indistinguishable, to every audit reading
`ctx.rootFiles`, from a site that has none. Same defect, one layer over, and the
non-page audits rest on it. Left out to keep the first change reviewable; it is
the first follow-up, not a maybe.

## 7. Score integrity

### 7.1 A zero-evidence scan must be unscored, not scored low

Measured: `ridge.com` scores 43 and `westontable.com` 37 on scans that fetched
nothing. `allbirds.com`, a real store, scores 51. The numbers overlap, so a
reader cannot separate "this store is mediocre" from "we never saw this store".

Rule: when `origin-reachable` or `unblocked-fetches` is unmet, the scan is not
judgeable and the report carries **no score** — not a zero, not a 38. A number
is a claim about the site; the truth is that no claim can be made.

Note this is a weaker justification than the first draft's, and an honest one.
The draft claimed gating would inflate a blocked site to 100. §2.2 shows it
deflates to 38. The reason to suppress the score is that it is meaningless in
either direction, not that it is generous.

`rendered-body` and `sample-adequate` do **not** clear `judgeable`. A JS-shell
site was seen; what it serves is a genuine finding about it (§7.4).

### 7.2 A gated category must not silently rebalance the score

Measured at +5 to +12 for shell sites, with `excalidraw.com` reaching 74 against
`allbirds.com`'s 51. The mechanism: `hasAssessableCheck` drops a category whose
checks are all `na`, so `calculateOverallScore` removes its evidence mass from
the denominator (`scorer.ts:98`). Four categories drop on every shell scan.

The first draft's fix for this was to "exclude the category from numerator and
denominator", which is a restatement of the behaviour that causes the problem.
It fixed nothing. Two things actually work:

- **(a)** Escalate: when gated evidence mass exceeds a threshold fraction of the
  registry's total mass, `judgeable` goes false and §7.1 applies to the whole
  scan. On the measured shell corpus, four of eight categories drop, which is
  well over any reasonable threshold — so shells become unscored too.
- **(b)** Keep the category in the denominator at a penalty score. Rejected: it
  is a claim about a site we did not read, which is the defect, inverted.

**(a) is the design.** A JS-shell site therefore reports no score and a critical
`server-rendered` failure, which is the accurate pair of statements.

The mass that counts toward the threshold is only what the gate itself removed:
checks tagged `skipped:no-evidence`. Page-type skips (`skipped:page-type`)
never count. A site with no blog and no product pages loses those audits
legitimately, and counting that mass would mark small honest sites unscored —
the calibration run would then measure the wrong rule.

The threshold fraction is not set in this document. It comes out of the
calibration run (§8.3); writing a number here first would be a guess wearing a
specification's clothes.

### 7.3 The report needs a shape for "unscored"

`ScanReport.overallScore` is `number` (`types.ts:196`). Nullable is the honest
shape and a breaking change: **70** `overallScore` references and **36**
`scoreTier` references across five packages.

```ts
overallScore: number | null;
scoreTier: ScoreTier | null;
scanValidity: {
  judgeable: boolean;
  evidence: Record<EvidenceKey, boolean>;
  reasons: Partial<Record<EvidenceKey, string>>;
};
```

Renderers must show `null` as "Not scored — <reason>", never as `0` and never as
`N/A` beside a coloured tier badge. The website's `summarize()` currently
*throws* on a missing `overallScore`, pinned by
`packages/website/src/islands/report-viewer.test.ts:49`; it must accept `null`
and keep rejecting `undefined`.

Ships as a `major` changeset.

### 7.4 A JS shell must still be judged, not excused

If `rendered-body` unmet silenced everything, a client-rendered site would escape
the finding that it is client-rendered — the one thing an agent cannot work
around. So `content-extraction/server-rendered` is exempt from `rendered-body`,
and `access-crawl-control` is exempt from `unblocked-fetches`: being blocked is
what those audits are about. `operability-safety/no-blocking-captcha`, which
passed on a captcha wall in §1, is exempt for the same reason and must be fixed
to report the wall rather than its absence.

### 7.5 `na` currently leaks into recommendations

Pre-existing; this change multiplies it. `orchestrator.ts:424` builds
`recommendations` with `c.status !== 'pass'`, which includes every `na`.
`packages/report` already does it right (`view-model.ts:186` filters to
`fail | warn`). Core must match. In scope, because this change is what makes it
visible.

### 7.6 What a shell report looks like, decided once

A gated shell scan reports no score, one critical `server-rendered` failure and
roughly 140 not-assessed stubs. For the site's owner that is the right report:
the one finding that matters, undiluted by a number. What disappears is the
score a competitor comparison would have used. Accepted, on purpose — the score
such a comparison was using carried +5 to +12 of pure artifact (§2.2), so the
comparison was already misinformation with better ergonomics.

## 8. Requirement assignment

The first draft assigned requirements by category, and the measurement killed it:

```
category               audits reading ctx.pages / total
access-crawl-control                  14 / 39
agent-interfaces                       5 / 26
machine-discovery                     14 / 23
operability-safety                    27 / 48
agentic-commerce                      10 / 10
answer-readiness                      33 / 33
content-extraction                    27 / 27
structured-data                       14 / 14
```

Four of eight categories are mixed. The draft's table would have under-gated
about 33 audits and over-gated about 21. Category is the wrong axis.

**The predicate is whether the audit reads `ctx.pages`,** which is a static
property of the source and greppable — `scripts/spike/reads-pages.txt` holds the
143 ids the grep produces today. The first draft dismissed this as "runtime
magic"; that was a description of the worst implementation of it. A static grep
has no runtime, no proxy and no untaken-code-path problem.

Design:

- `AuditMeta` gains `requires?: EvidenceKey[]`, and `AuditMetaSchema` in
  `schemas.ts` must accept it or every meta fails `v2-meta.test.ts`.
- Default for an audit that reads pages: all four keys. For one that does not:
  `['origin-reachable']`.
- The default is **not** inferred at runtime. A build-time check
  (`scripts/check-requires.mjs`, alongside `check-dossiers.mjs`) greps each audit
  source and fails when its declared `requires` disagrees with what it reads.
  That makes the mapping explicit in the file, per this repo's habit, and stops
  it drifting when an audit starts reading something new.
- The check covers the gatherer layer, not only `ctx.pages`. The gatherer layer
  exists precisely so audits do not touch pages directly, so a pages-only grep
  classifies the best-behaved audits as safe and leaves them running blind on a
  shell scan — the vacuous-verdict bug, one layer down. Audits reach gatherers
  through module imports (`from '../../gatherers/<name>'`), so the script keys
  on those imports and carries a static map from each gatherer module to the
  evidence keys its input needs: `text-metrics`, `extraction`, `css-rules`,
  `media`, `commerce`, `structured-fields`, `tokens`, `ua-parity` and
  `sampled-pages` are page-fed; `robots`, `sitemap`, `feeds`, `domains` and
  `conditional` are not. An audit's expected `requires` is the union of its
  direct reads and its imported gatherers'. A gatherer missing from the map
  fails the build — that is what keeps the map honest when one is added. The
  union will push the gated population above the 143 direct readers; the
  calibration run reports the real count.
- §7.4's exemptions are the deliberate disagreements, and each carries a comment
  saying so. The check reads them from an allowlist, not from the absence of a
  rule.

Requirements do not go in the dossier: the requirement is a property of the
scan, not of the evidence for the signal. Recorded here so a future reader does
not go looking.

## 9. Rollout

**Step 0 — split the text metric (§2.4).** Independent of everything else, and
it is shipping a false critical failure at `velasca.com` and `hiutdenim.co.uk`
today.

`getMainContentText` serves two jobs that want opposite scopes. Shell detection
asks whether the server rendered any text at all, and wants the whole `<body>`.
The content audits — dates, numbers, keyword density, content depth — ask what
the main content says, and want navigation, footers and cookie banners kept
out. Widening the one function to fix the first job pours header text into
every content regex, which is the same bug pointed the other way. The function
has nine call sites across seven audit files plus `gatherers/ua-parity.ts`,
whose output five more audits read, so the blast radius is the audit suite, not
one verdict. (The first draft said 25 call sites across 11 files; recounted
2026-08-26.)

So: two functions.

- `getRenderedText($)`, new: `<body>` minus
  `script`/`style`/`noscript`/`template`. Consumed by `server-rendered` now and
  by the gate's `rendered-body` later.
- `getMainContentText($)`, kept for the content audits, selection bug fixed:
  among all `<main>` elements take the one holding the most text — not
  `.first()` — and fall back to `<body>` only when none holds any.
  `velasca.com`'s empty `<main>` falls through to its 194-word body;
  `hiutdenim.co.uk`'s 49-character first-of-four stops shadowing the real one.

Re-run the 100-store benchmark and record every verdict that moves, across the
consumers of both functions — not only `server-rendered`. Own changeset,
`major` (a scan's output changes).

1. `scan-evidence.ts` + tests, unwired.
2. Wire into `CheckContext`; `test-utils.ts` and the eight hand-built contexts.
3. `server-rendered` consumes it. First behaviour change, one audit.
4. `requires` on meta + `check-requires.mjs` + `planAudits` gate, behind an
   off-by-default option.
5. Calibration (§8.3 below). Numbers recorded in this document.
6. Turn on by default; recommendations fix (§7.5); score suppression (§7.1,
   §7.2); report/CLI/MCP/website null path (§7.3). One `major` changeset.

Steps 0–3 are safe to merge alone. Step 6 must not be split: a half-applied §7.1
is worse than none.

### 8.3 Calibration

`scripts/benchmark-stores.ts` scans 138 stores. Run it with the gate off and on
at `--concurrency=2 --delay=3` (so the run does not re-create #18), twice.
Stores that disagree between runs are excluded as rate-limit noise — except
stores sitting near the `rendered-body` boundary (within ±10 words or ±40
characters of the threshold), which are hand-checked instead of discarded: a
boundary flapper is the most informative store in the run, not the least.

Report three things:

- Gated audit count per store. A store losing more than a stated fraction is a
  false trip until a hand check says otherwise.
- Score delta per store, and the count of stores that become unscored.
- Every `rendered-body` shell decision, each confirmed by `curl`. The
  false-positive rate goes in this document as a number, as §6.3 already does
  for the 45-site spike sample.
- At least one storefront that answers with a geo `302` to a country subdomain,
  confirming §6.1's same-registrable-domain carve-out holds.

The §7.2 escalation threshold is set from this run, not before it.

### 8.3.1 Calibration result (run 2026-08-26)

**Deviation from the plan above, stated plainly.** The run covers **24 stores,
not 138**, and each configuration ran **once, not twice**. A full double pass is
about four hours of wall clock at `--concurrency=2 --delay=3000`. The 24 were
chosen to include every edge case the spike named: the three confirmed shells
(`gymshark.com`, `tattly.com`, `quitenice.co`), two sites that answer with a bot
wall (`sokoglam.com`, `aloyoga.com`), and the two stores step 0 rescued
(`velasca.com`, `hiutdenim.co.uk`). Noise is therefore identified by inspection
rather than by run-to-run agreement.

**Gated evidence mass per store — the number the threshold comes from:**

```
0.000   20 stores   every storefront that served readable pages
0.616   sokoglam.com          (Kasada bot wall)
0.631   gymshark.com          (homepage 1 word; only a product page rendered)
0.639   quitenice.co          (114-byte body — parked or dead origin)
0.691   tattly.com            (20 words in <body>)
```

There is no store between 0.000 and 0.616. The distribution is not a gradient
with a judgement call in the middle; it is two clusters with a 62-point gap. The
threshold is set at **0.35**, in the middle of that gap. Any value in
(0.00, 0.61) produces the same verdicts on this corpus, so the choice is not
load-bearing — which is the useful thing to know about it.

**Scores.** Twenty stores stayed scored. Eighteen moved by 0 or ±1, which is
run-to-run noise, not the gate — the gate removes only audits that could not be
fed, so a scored store's remaining verdicts are unchanged by construction.
`aloyoga.com` moved 52 → 58 because it answered a bot wall on the first run and
served normally on the second; it is a status change, not a scoring change.

**Four stores became unscored**, each confirmed by hand:

```
gymshark.com    <body> holds 1 word; server-rendered fails; only a product page rendered
tattly.com      <body> holds 20 words / 127 characters
quitenice.co    114-byte body, no <main>, no text
sokoglam.com    Kasada challenge — judgeable false, not an escalation
```

Three are shells and one is a wall. **No false trip on the 20 real
storefronts**, and no store needed the boundary hand-check the plan reserved for
flappers, because none sat near the `rendered-body` threshold.

**Gated audit counts** are 127–149 of 212 on the four, and 0 on the other
twenty. The gate is inert on a scan that read the site, which is the property
worth stating: it costs nothing when the evidence is there.

**Side effect worth recording.** A gated scan is much faster, because a skipped
audit is never constructed: `gymshark.com` took 14.8s gated against roughly 60s
ungated.

**The geo case (§6.1) was checked separately** and produced a rule change; see
the amendment in §6.1. `zalando.com` and `aboutyou.com` both answer a `302` to a
sibling ccTLD, which the eTLD+1 rule alone would have called unreachable.

## 10. Testing

**Unit** — `scan-evidence.test.ts`: each requirement met and unmet, plus the
boundaries. `www.` redirect met; cross-host 301 met; cross-host 302 unmet;
non-HTML content type unmet; 429 unmet with `isRateLimit`; a CJK page (6
whitespace words, 400 characters) met; a page with an empty `<main>` and 194
words in `<body>` **met** (the `velasca.com` regression).

**Integration** — `audit-runner.test.ts`: a gated audit is never constructed
(assert `create` is not called), yields one `na` stub tagged
`skipped:no-evidence`, and its explanation names the key.
`orchestrator.test.ts`: a WAF-blocked scan reports `overallScore === null`.
`scorer.test.ts`: §7.2 escalation, pinned against the measured excalidraw case —
gating four categories must not produce a number.

**Harnesses** — six call sites in four files run `runAudits` with hand-built
contexts and therefore route through the gate: `corpus-conformance.test.ts`
(×3), `scan-labs.test.ts`, `verify-scan-results.test.ts`,
`snapshot-regression.test.ts`. Corpus fixtures are small by design; left alone,
several would self-gate and turn a conformance assertion into a vacuous `na` — a
green suite proving nothing. Each passes `allEvidenceMet()` explicitly, and one
new fixture exercises the gate on purpose.

**Regression pinning** — reverting §7.1 must fail a test asserting a 0-page scan
is unscored. Reverting §2.4's metric fix must fail a `velasca.com`-shaped
fixture.

## 11. Consumers to update

- **Coverage view.** `view-model.ts:176-186` buckets `na` by tag; add
  `skippedNoEvidence` and its reason list, and surface it in the terminal, HTML
  and Markdown renderers. "154 audits not assessed" needs the sentence that says
  why.
- **`server-rendered`.** Reads `ctx.evidence.renderedByPage`; judges every page
  and reports a ratio instead of `pages[0]`; the no-page case becomes `na`.
- **`no-bot-detection`, `no-blocking-captcha`.** Exempt from the gate (§7.4);
  `no-blocking-captcha` additionally must stop passing on a wall.
- **Trace.** `AuditTrace.outcome` gains `'gated'` and the unmet keys. This
  widens a published union — breaking for anything typed against NDJSON output.
- **`verify-scan-coverage.ts`.** Must report gated counts per store, or the gate
  becomes a comfortable place for a broken audit to hide — #17 with a new label.
- **MCP, CLI, website.** All consume `overallScore`; all need the null path.

## 12. Open questions

1. **A fifth `CheckStatus`, `'unknown'`, instead of a tag?** It would turn every
   `status === 'na'` site in four packages into a compile error until reviewed —
   both the benefit and the cost. §7.2 works either way.
2. ~~Should a 429 be retried once with backoff?~~ Resolved into §6.2: one
   retry with backoff before `unblocked-fetches` goes unmet, shipping with
   step 6.
3. **`root-files-definitive`** (§6.5) — first follow-up.
4. **Soft 404s and consent walls.** Both return 200 with real-looking HTML. The
   first is judged as the site; the second may trip `rendered-body` and be
   reported as a shell — the right skip for the wrong stated reason. Out of
   scope, named so the reason text does not overclaim.
5. **Does `rendered-body` need an evidence record?** It claims nothing about a
   consumer, so the meta law does not reach it, but it is an empirical rule with
   a measured error rate and this repo writes those down. Proposal:
   `docs/evidence/method/scan-evidence.md`, not an audit dossier.

## 13. Known weak points, accepted

- The `rendered-body` error rate is measured on 45 sites, not bounded.
- `requires` encodes what an audit reads. `check-requires.mjs` greps for
  `ctx.pages` and the gatherer imports; a helper that reaches pages outside
  both still slips past. The check is a ratchet, not a proof.
- §7.2's threshold is unset until calibration, so the design is not fully
  specified until step 5 runs.
- The spike corpus is 5 shells, 2 walls, 2 controls, 43 storefronts. It is
  Shopify-heavy and English-heavy, and every number here inherits that.
