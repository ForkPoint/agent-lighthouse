# Scan evidence gate — design

Status: draft, reviewed once (§14), awaiting user review
Date: 2026-08-25
Area: `packages/core`, with forced changes in `report`, `cli`, `mcp`, `website`

## 1. Problem

A scan judges a site from what the fetch phase returned. Nothing checks whether
the fetch phase actually saw the site. When it did not, 236 audits still run and
each invents a verdict from an empty or hostile response.

Three failures already shipped from this gap:

- **#18** — the scanner tripped Cloudflare's per-IP rate limit, read its own 429
  as the site's firewall, and failed 36 of 48 storefronts at critical priority.
  The fix taught one audit (`no-bot-detection`) about 429. The other 235 were
  left believing the empty body.
- **#17** — five audits reported a plausible `notApplicable` on every storefront
  they were broken on, and nobody noticed for a release.
- **The JS-shell case, still open.** A client-rendered page serves
  `<div id="root"></div>`. `orchestrator.ts:337` keeps it (status 200, non-empty
  body), so roughly 150 content, structured-data and answer-readiness audits
  read an empty DOM and report a confident fail against a site whose content
  exists.

The common shape: **missing evidence is indistinguishable from a negative
finding.** An audit cannot tell "this site has no `<main>`" from "this scan
never obtained this site's HTML", so it reports the first.

## 2. Goal

Decide, once per scan and before any audit runs, which classes of evidence the
scan actually obtained. Audits that need evidence the scan does not have are
skipped as `notApplicable` with the reason attached, instead of running blind.

## 3. Non-goals

- No headless browser. The scan stays fetch + parse.
- No new network requests. The gate reads what the fetch phase already produced.
- No change to what any audit *concludes* when its evidence is present.
- Not a replacement for `applicablePageTypes`. That gate stays and runs first.
- Not a soft-404 or consent-wall detector. Both are real and both are out of
  scope (§12.4).

## 4. Decisions taken in brainstorming

| Question | Decision |
| :-- | :-- |
| What does the gate produce? | Per-audit evidence requirements, resolved into `na` stubs. Not a whole-scan abort, not a confidence banner. |
| Which requirements in v1? | `origin-reachable`, `unblocked-fetches`, `rendered-body`, `sample-adequate`. |
| How is `rendered-body` decided? | Conservative multi-signal heuristic over the served HTML. No browser. Calibrated against the 138-store benchmark. |
| How do 236 audits get requirements? | One default per category in `audit-config.ts`, overridden per audit via `meta.requires` only where it differs. |

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
  /** Scan-level verdict per key. */
  met: Record<EvidenceKey, boolean>;
  /** One sentence per unmet key, shown in the `na` stub and the trace. */
  reasons: Partial<Record<EvidenceKey, string>>;
  /** Per-page render verdict, keyed by the page's scanned url. */
  renderedByPage: Record<string, boolean>;
  /** Page types with at least one fetched, rendered page. */
  usablePageTypes: Set<PageType>;
  /**
   * False when the scan never established contact with the site well enough
   * for any verdict to mean anything (§7.1). Drives score suppression.
   */
  judgeable: boolean;
}

export function buildScanEvidence(input: {
  requestedUrl: string;
  homepageResult: FetchResult;
  pages: PageContext[];
  rootFiles: Record<string, FetchResult>;
  wafProtection: WafProtection | null;
}): ScanEvidence;

/** All requirements met. For test harnesses that are not exercising the gate. */
export function allEvidenceMet(): ScanEvidence;
```

### 5.2 Data flow

1. `runScan` fetches root files and pages. Unchanged.
2. Page contexts are built (`orchestrator.ts:319-357`). Unchanged.
3. `detectWafProtection` runs (`orchestrator.ts:378`). Unchanged.
4. **New:** `buildScanEvidence(...)` runs immediately after, before the
   `CheckContext` is assembled.
5. `CheckContext` gains `evidence: ScanEvidence` — **required, not optional**.
   An optional field would fail open: a caller that forgets it silently disables
   the gate, which is the same class of silent-nothing bug this design exists to
   remove. The cost is bounded and was measured (§14.2): 224 of the 231 audit
   test files build their context through `__tests__/test-utils.ts`'s
   `mockCheckContext`, so the field is added there once. Eight files build a
   context by hand and take `allEvidenceMet()` explicitly.
6. `planAudits` gains a second skip reason beside `TAG_SKIPPED_PAGE_TYPE`.
7. The report carries the evidence verdict (§7.2).

### 5.3 Skip mechanics

`planAudits` (`audit-runner.ts:88`) already owns the skip path: it emits an `na`
`stubCheck` tagged `skipped:page-type` and never constructs the audit. The gate
reuses it exactly, with a new tag:

```ts
export const TAG_SKIPPED_NO_EVIDENCE = 'skipped:no-evidence';
```

Order inside `planAudits`, per audit:

1. `applicablePageTypes` mismatch → `skipped:page-type` stub. Unchanged, and
   first, so no existing skip reason changes wording.
2. Any unmet requirement → `skipped:no-evidence` stub. Explanation names the key
   and its reason: `Not assessed: the scan did not obtain readable page HTML
   (JS-only shell: 8 words of text, empty #__next root).`
3. Otherwise runnable.

`sample-adequate` is resolved per audit, not scan-wide: unmet when none of the
audit's `applicablePageTypes` appears in `usablePageTypes`. An audit with no
declared page types is resolved against the homepage.

Putting the gate in `planAudits` rather than inside each audit is the point. An
audit that checks its own evidence is an audit that can forget to; the gate runs
before any audit code, so forgetting is unreachable.

## 6. The four requirements

### 6.1 `origin-reachable`

Source: `homepageResult.status`, `.finalUrl`, `.contentType`, `.error`
(`fetcher.ts:51`).

Met when the homepage returned 2xx, served an HTML content type
(`text/html` or `application/xhtml+xml`), **and** `finalUrl`'s host matches the
requested host, treating these as the same host:

- an added or dropped `www.` label
- an `http:` → `https:` upgrade

The content-type condition is what catches a PDF, a JSON API root or a bare XML
feed answering at `/`. Today those parse into a nonsense DOM that every content
audit then judges (§14.3, finding R7).

Unmet examples: parked domain, 403 login wall, 5xx, DNS failure, redirect to an
unrelated host (geo-gate, marketplace landing), non-HTML root.

A cross-host permanent redirect (`301`/`308`) counts as **met**, with the final
host stamped in the report — that is a domain migration, and the site the user
reached is a real site. A cross-host `302`/`307` counts as unmet: a temporary
bounce to an interstitial is not the site.

### 6.2 `unblocked-fetches`

Source: `ctx.wafProtection` and every page's status.

Unmet when `wafProtection.isBlocked` is true, or when the homepage returned 429.

Kept distinct in the reason text, because they call for different operator
action, and #18 exists because they were once conflated:

- `isRateLimit === true` → "the scan was throttled; retry slower" — this is our
  fault, not the site's.
- any other provider → "the site's firewall refused the scan".

Note the asymmetry with `sample-adequate`: a scan where the homepage answered
but three of five internal pages were refused stays *met* here, and loses those
pages through `sample-adequate` instead. Blocking is judged at the origin;
coverage is judged per page.

### 6.3 `rendered-body`

Per page. Met when the served HTML carries text a non-JS consumer can read.

The detection already exists in `content-extraction/server-rendered.ts:47`:
`getWordCount($) > 50 || getMainContentText($).length > 200`. It moves into
`scan-evidence.ts` as the single implementation, and the audit consumes the
gate's verdict instead of recomputing it (§8.2).

The `||` in that condition is load-bearing and must survive the move.
`getWordCount` splits on whitespace (`parser.ts:342`), so a full Chinese or
Japanese page counts a handful of "words"; the character branch is what stops
the gate silencing every CJK site. `answer-readiness/direct-definitions` learned
this exact lesson in the v2 rework.

The gate's rule is deliberately stricter than a bare word count, so a thin but
real page is not silenced. Unmet only when the low-text condition holds **and**
at least one corroborating shell signal is present:

```
unmet(page) =
  (wordCount <= 50 && mainContentText.length <= 200)
  && (
       emptyFrameworkRoot          // #root | #__next | #app | [data-reactroot], no text inside
    || noscriptDemandsJs           // <noscript> whose text matches /enable (JavaScript|JS)/i
    || scriptToTextByteRatio > 50  // script bytes vs visible text bytes
  )
```

`noscriptDemandsJs` reads the raw DOM, not `getMainContentText`, which strips
`<noscript>` (`parser.ts:336`).

`scriptToTextByteRatio` is not computed here. `gatherers/text-metrics.ts` and
`content-extraction/hydration-payload-share.ts` already measure the script-versus-text
split; the gate reuses one of them rather than making a third pass over a body
that can reach the 5 MB cap.

Every threshold is a named constant in one place, and every one is calibrated
against the benchmark corpus before merge (§10.3), not guessed.

Scan-level `met['rendered-body']` is true when the homepage rendered.

### 6.4 `sample-adequate`

Source: `pages` and `renderedByPage`.

`usablePageTypes` = the set of `pageType` values among pages that were fetched
(they are already filtered to status 200 with a body at `orchestrator.ts:334`)
**and** whose `renderedByPage` entry is true.

Scan-level `met` is true when `usablePageTypes` is non-empty. The per-audit
resolution in §5.3 is what actually matters; the scan-level flag exists for the
report.

This closes the "1 of 1 page" vacuous verdict: today `planAudits` checks only
that a page of the right *type* exists, never that its fetch produced anything.

### 6.5 Deliberately not in v1: `root-files-definitive`

A 429 or a timeout on `robots.txt` is indistinguishable, to every audit reading
`ctx.rootFiles`, from a site that has no `robots.txt`. That is the same defect
in a different place, and the whole `access-crawl-control` and
`machine-discovery` default (`['origin-reachable']`) sits on top of it.

It is left out of v1 only to keep the first change reviewable. It is the first
follow-up, not a maybe (§12.5).

## 7. Score integrity

The part most likely to go wrong. Three of these failure modes are structural,
not incidental.

### 7.1 Blocking the scanner must not raise a score

`calculateCategoryScore` drops `na` checks from the denominator, and
`calculateOverallScore` drops any category whose checks are all `na`
(`scorer.ts:29`, `scorer.ts:98`). Correct for a site that has no commerce
surface. **Wrong** for a site that refused the scan.

Without a counterweight, a WAF-walled site loses every page audit to `na`,
keeps the handful of robots.txt and header audits that still had evidence, and
can score 100 for admitting nothing. "Block the scanner, score better" is worse
than the bug this design fixes.

Rule: when `origin-reachable` or `unblocked-fetches` is unmet, the scan is
**not judgeable** (`evidence.judgeable === false`) and the report carries **no
score at all** — not a zero. A zero is a claim about the site; the truth is that
no claim can be made.

`rendered-body` and `sample-adequate` do **not** clear `judgeable`. A JS-shell
site was seen; what it serves is a genuine finding about it (§7.3).

### 7.2 The report needs a shape for "unscored"

`ScanReport.overallScore` is `number` (`types.ts:196`). Making it nullable is a
breaking change across `report`, `cli`, `mcp` and `website` — 70 `overallScore`
references and 36 `scoreTier` references across five packages (§14.2). It is
also the honest shape. Proposed:

```ts
overallScore: number | null;
scoreTier: ScoreTier | null;
scanValidity: {
  judgeable: boolean;
  evidence: Record<EvidenceKey, boolean>;
  reasons: Partial<Record<EvidenceKey, string>>;
};
```

Every renderer must render `null` as "Not scored — <reason>", never as `0` and
never as `N/A` beside a coloured tier badge. `getTierLabel` already answers
`N/A` for a null tier (`constants.ts`), which is a start, not a sentence an
operator can act on.

Ships as a `major` changeset.

### 7.3 A JS shell must still be judged, not excused

The opposite perverse incentive: if `rendered-body` unmet silenced everything
downstream, a client-rendered site would escape the finding that it is
client-rendered — which is precisely what an agent cannot read.

So `content-extraction/server-rendered` is **exempt** from `rendered-body`; a
shell is its subject matter. It keeps failing, at critical priority, and the
`na` explanations on the silenced audits name it.

The same exemption applies to the whole `access-crawl-control` category for
`unblocked-fetches`: being blocked is what those audits are about.

### 7.4 `na` currently leaks into recommendations

Pre-existing, and this design multiplies it. `orchestrator.ts:424` builds
`recommendations` with `c.status !== 'pass'`, which includes every `na`. Today
that quietly surfaces page-type skips as recommended fixes; after this change it
would surface every gated audit.

`packages/report`'s view-model does it right already — `topFixes` filters to
`fail | warn` (`view-model.ts:186`). Core must match: filter to `fail | warn` in
`recommendations` and `topFails`. In scope, because this change is what makes it
visible.

### 7.5 A gated category must not silently rebalance the score

The sharpest hole found in review (§14.3, finding R1), and it survives §7.1.

Take a store whose product pages answer 429 while its homepage does not.
`judgeable` stays true. Every `agentic-commerce` audit gates to `na`, so
`hasAssessableCheck` drops the whole category, so `calculateOverallScore`
removes its evidence mass from the denominator (`scorer.ts:98`). The site is now
scored only on the categories that happened to survive — and, because commerce
is where most stores lose points, its score goes **up** for having refused us.

That path is exactly the one §7.1 closes at the scan level, reappearing one
level down at the category level.

Root cause: `status: 'na'` currently means two different things — "this site
genuinely has no such surface" (drop it, correct) and "this scan obtained no
evidence" (do not drop it, currently indistinguishable).

Fix: the scorer learns the difference from the tag it already receives.

- A category whose `na` checks are mostly `skipped:no-evidence` reports
  `score: null` and is excluded from the overall **numerator and denominator**,
  with the category shown as "Not assessed" rather than dropped silently.
- The threshold ("mostly") is a stated fraction of the category's evidence mass,
  not a check count, so gating three grade-A audits weighs more than gating ten
  grade-C ones.
- When gated mass exceeds a second, higher fraction of the *total* registry
  mass, `judgeable` goes false and §7.1 applies to the whole scan.

Alternative considered and not taken: a fifth `CheckStatus`, `'unknown'`,
distinct from `'na'`. Cleaner to read, and it would make every `status === 'na'`
site in the four packages a compile error until reviewed — which is both its
main benefit and its main cost. The tag already carries the distinction, and
`view-model.ts:176` already buckets by tag. Recorded as open question §12.1.

## 8. Consumers to update

### 8.1 Coverage view

`view-model.ts:176-186` buckets `na` checks by tag into `skippedByPageType`,
`errored`, `notApplicable`. Add `skippedNoEvidence` as a fourth bucket, plus its
reason list, and surface it in the terminal, HTML and Markdown renderers. An
operator seeing "154 audits not assessed" needs the sentence that says why.

### 8.2 `server-rendered` audit

Reads `ctx.evidence.renderedByPage` instead of recomputing the word count.
Behaviour change: it currently judges `pages[0]` only and returns `warn` when no
page exists (`server-rendered.ts:35`). It should judge every fetched page and
report a ratio, and the no-page case belongs to `origin-reachable`, so it
becomes `na`. Its three existing tests change with it.

### 8.3 `no-bot-detection`

Its 429 special-case (#18) becomes a special-case of `unblocked-fetches`. Keep
the audit's own logic — it is the audit whose subject is bot defense — but it
must not be gated by `unblocked-fetches` (§7.3).

### 8.4 Trace

`AuditTrace.outcome` is `'ran' | 'skipped' | 'error'` (`audit-trace.ts:16`), and
`outcomeOf` maps it from tags. Add `'gated'` as a fourth outcome and carry the
unmet keys. `--trace` and `LOG_LEVEL=debug` then answer the question the gate
creates: which audits did not run, and what was missing. This widens a public
union type — breaking for anything typed against NDJSON trace output.

### 8.5 `verify-scan-coverage.ts`

Proves every registered audit produced a result. Gated audits produce `na`
stubs, so it still passes. It must additionally report the gated count per
store, or the gate becomes a comfortable place for a broken audit to hide — the
#17 failure mode with a new label.

### 8.6 MCP, CLI, website

All three consume `overallScore` and need the null path. The website's report
viewer is stricter than the others: `summarize()` throws when `overallScore` is
absent, pinned by `packages/website/src/islands/report-viewer.test.ts:49`. It
must accept `null` and reject `undefined`, and the test must say which is which.

### 8.7 Schema and meta

`AuditMeta` gains `requires?: EvidenceKey[]`, so `AuditMetaSchema` in
`schemas.ts` must accept it or every meta fails validation in `v2-meta.test.ts`.
`check-dossiers.mjs` is unaffected: no grade, tier, slug or source changes.

## 9. Requirement assignment

`audit-config.ts` gains:

```ts
export const CATEGORY_REQUIRES: Record<string, EvidenceKey[]> = {
  'access-crawl-control': ['origin-reachable'],
  'machine-discovery':    ['origin-reachable'],
  'agent-interfaces':     ['origin-reachable'],
  'content-extraction':   ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  'structured-data':      ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  'answer-readiness':     ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  'agentic-commerce':     ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  'operability-safety':   ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
};
```

`AuditMeta` gains `requires?: EvidenceKey[]`. Set it only where the audit
differs from its category — the §7.3 exemptions, and audits that read only root
files (`content-extraction/markdown-alternate` reads `rootFiles`, so it needs no
`rendered-body`).

Resolution: `meta.requires ?? CATEGORY_REQUIRES[meta.category] ?? []`. An
unknown category resolves to no requirements, which fails open — a new category
is never silently gated.

The default table is a guess about what 236 audits read, and a wrong row gates a
whole category. Calibration (§10.3) is what turns it from a guess into a
measurement: any audit that gates on a store where a hand check shows the
evidence was present is a wrong row.

An audit that sets `requires: []` says why in a code comment. This does not go
in the dossier: the requirement is a property of the scan, not of the evidence
for the signal. Recorded here so a future reader does not go looking.

## 10. Testing

### 10.1 Unit

`scan-evidence.test.ts` — one case per requirement, met and unmet, plus the
boundaries: `www.` redirect met, cross-host 301 met, cross-host 302 unmet,
non-HTML content type unmet, 429 unmet with `isRateLimit`, empty `#__next`
unmet, thin-but-real page (60 words, no shell signal) **met**, CJK page (6
whitespace words, 400 characters) **met**.

### 10.2 Integration

`audit-runner.test.ts` — an audit whose requirement is unmet is not constructed
(assert `create` is never called), produces one `na` stub tagged
`skipped:no-evidence`, and the stub's explanation names the key.

`orchestrator.test.ts` — a WAF-blocked scan reports `overallScore === null` and
`judgeable === false`; a JS-shell scan reports a number, `server-rendered`
failing, and the content audits gated.

`scorer.test.ts` — §7.5: a category gated to `na` reports `score: null` and
leaves the overall denominator, and the overall score does not rise.

### 10.3 Calibration — the gate that decides whether this ships

`scripts/benchmark-stores.ts` already scans 138 stores and stores results. Before
merge, run it with the gate off and on, and diff:

- **Gated count per store.** A store that loses more than a stated fraction of
  its audits is a false trip until proven otherwise, and each one is opened by
  hand.
- **Score delta per store.** Any score that *rises* by more than a stated margin
  is investigated — a rise means audits that were failing are now silent, which
  is either the fix working or §7.1/§7.5 leaking.
- **`rendered-body` decisions.** Every page the heuristic calls a shell gets a
  manual `curl` check. The false-positive rate is written into this document
  before merge, as a number.

Run at `--concurrency=2 --delay=3` so the run does not re-create #18 and measure
its own throttling. Two runs, and stores that disagree between them are treated
as rate-limit noise rather than as data.

### 10.4 Harnesses that build their own context

Six test files call `runAudits` with a hand-built `CheckContext`, so they route
through `planAudits` and therefore through the gate:
`__tests__/corpus-conformance.test.ts` (×3), `__tests__/scan-labs.test.ts`,
`__tests__/verify-scan-results.test.ts`, `__tests__/snapshot-regression.test.ts`.

Corpus fixtures are small by design. Left alone, several would trip
`rendered-body`, gate their audits, and turn a conformance assertion into a
vacuous `na` — a green suite proving nothing, which is the failure mode CLAUDE.md
already warns about for stale build artifacts. Each of the six passes
`allEvidenceMet()` explicitly, and one new fixture exercises the gate on purpose.

### 10.5 Regression pinning

Reverting §7.1 must fail a test: a fixture where a WAF-blocked scan would
otherwise score above 90 asserts `overallScore === null`. Reverting §7.5 must
fail its own: a fixture where gating `agentic-commerce` would otherwise raise
the overall score asserts it did not.

## 11. Risks

| Risk | Mitigation |
| :-- | :-- |
| `rendered-body` false trip silences ~150 audits on a real site | Multi-signal AND condition; character branch for CJK; benchmark calibration with a published false-positive number; the failure direction is quiet, not wrong |
| Score suppression breaks existing API consumers | Major changeset; explicit `scanValidity` block; the 106 call sites are enumerated (§14.2) |
| Gate becomes a place to hide broken audits | `verify-scan-coverage.ts` reports gated counts; trace outcome `gated` is per audit |
| `CATEGORY_REQUIRES` rows are wrong | Calibration treats a gate-with-evidence-present as a defect in the table |
| A site games the gate to raise its score | §7.1 (scan unscored), §7.5 (category unscored) |
| Corpus fixtures silently self-gate | §10.4 — explicit `allEvidenceMet()`, one deliberate gate fixture |

## 12. Open questions

1. **A fifth `CheckStatus`, `'unknown'`, instead of a tag?** It would make every
   `status === 'na'` site in four packages a compile error until reviewed. That
   is both the benefit and the cost. §7.5 works either way.
2. **Is `overallScore: number | null` acceptable**, or should an unscored report
   keep a number and carry `judgeable: false` beside it? Nullable is honest and
   breaking; the alternative is compatible and easy for a consumer to ignore —
   and a consumer ignoring it is how "block the scanner, score 100" ships anyway.
3. **Does `rendered-body` need an evidence record?** It makes no claim about a
   consumer, so the meta law does not reach it. But it is an empirical rule with
   a measurable error rate, and this repo writes those down. Proposal: a short
   record at `docs/evidence/method/scan-evidence.md`, not an audit dossier.
4. **Soft 404s and consent walls.** A "Page not found" body and a cookie
   interstitial both return 200 with real-looking HTML. The first is judged as
   the site; the second may trip `rendered-body` and be reported as a JS shell,
   which is the right skip for the wrong stated reason. Both want their own
   requirement. Out of scope, named so the reason text does not overclaim.
5. **`root-files-definitive` (§6.5)** — first follow-up.
6. **Should a 429 be retried once with backoff** before the scan is declared not
   judgeable? It is our throttle, not the site's refusal. Separate change.

## 13. Rollout

1. `scan-evidence.ts` + tests, unwired. No behaviour change.
2. Wire into `CheckContext`; `test-utils.ts` and the eight hand-built contexts
   updated. Still nothing reads it.
3. `server-rendered` consumes it (§8.2). First behaviour change, one audit.
4. `CATEGORY_REQUIRES` + `planAudits` gate, behind an off-by-default option.
5. Benchmark calibration (§10.3). Numbers recorded in this document.
6. Turn on by default; `recommendations` fix (§7.4); score suppression (§7.1,
   §7.5); report/CLI/MCP/website null path (§7.2, §8.6). One `major` changeset.

Steps 1–3 are safe to merge on their own. Step 6 is the breaking one and should
not be split, because a half-applied §7.1 is worse than none.

## 14. Review

### 14.1 Angles taken

Perverse incentives · score arithmetic · public API surface · test-harness blast
radius · internationalisation · content-type and protocol edge cases · existing
audit overlap · schema and registry constraints · trace and tooling contracts ·
performance · determinism of the calibration · rollout reversibility · what the
repo's own rules require · what was deliberately excluded.

### 14.2 Measured, not assumed

| Claim | Measurement |
| :-- | :-- |
| Test blast radius of a required `evidence` field | 231 test files reference `CheckContext`; 224 go through `mockCheckContext`; **8** build one by hand |
| Public surface of a nullable score | **70** `overallScore` references, **36** `scoreTier`, across `core`, `report`, `cli`, `mcp`, `website` |
| Harnesses routed through `planAudits` | **6** call sites in 4 files (§10.4) |
| Existing JS-shell detection | `server-rendered.ts:47`, thresholds 50 words / 200 characters |
| `na` in recommendations | `orchestrator.ts:424`, filter is `status !== 'pass'` |

### 14.3 Findings that changed the plan

| # | Finding | Where it landed |
| :-- | :-- | :-- |
| R1 | A gated category leaves the overall denominator, so refusing us on product pages can raise a store's score. §7.1 does not cover it. | New §7.5 |
| R2 | `getWordCount` splits on whitespace, so a CJK page counts ~5 words. Dropping the character branch would gate every CJK site. | §6.3 |
| R3 | Corpus and snapshot fixtures route through `planAudits` and are small enough to self-gate, turning assertions vacuous. | §5.1 `allEvidenceMet`, §10.4 |
| R4 | A required `evidence` field looked like a 231-file migration; it is 9. The fail-open alternative was rejected on that measurement. | §5.2 |
| R5 | The website report viewer *throws* on a missing `overallScore` and has a test pinning it. Nullable is not a type-only change there. | §8.6 |
| R6 | `AuditMetaSchema` validates every meta; adding `requires` without it fails `v2-meta.test.ts`. | §8.7 |
| R7 | A non-HTML root (PDF, JSON, feed) returns 200 and parses into a nonsense DOM. Cheap to catch in `origin-reachable`. | §6.1 |
| R8 | `<noscript>` is stripped by `getMainContentText`, so the noscript signal must read the raw DOM. | §6.3 |
| R9 | `scriptToTextByteRatio` duplicates `text-metrics` and `hydration-payload-share`. A third pass over a 5 MB body is not free. | §6.3 |
| R10 | `robots.txt` 429 is the same defect one layer over, and the `access-crawl-control` default rests on it. | New §6.5, §12.5 |
| R11 | `AuditTrace.outcome` is a published union; adding `'gated'` is breaking for trace consumers. | §8.4 |
| R12 | The `CATEGORY_REQUIRES` table is a guess until calibration tests it. | §9 closing, §10.3 |

### 14.4 Positions held under challenge

- **Not a whole-scan abort.** A blocked site still yields real robots.txt and
  header findings. Throwing them away to simplify the report costs the operator
  the only actionable part of a bad scan.
- **No headless browser.** It would fix `rendered-body` properly and change what
  a scan is: a dependency, a runtime budget, and a second definition of "what
  the site serves" that every audit would then have to choose between.
- **Gate in `planAudits`, not in `Audit`.** A base-class hook is prettier and
  optional; 236 audits proved that optional means forgotten.
- **`na`, not `fail`, for gated audits.** CLAUDE.md's rule is that absence is
  `notApplicable`. Missing evidence is a stronger case for it than missing
  adoption.

### 14.5 Known weak points, accepted

- The `rendered-body` heuristic has no ground truth beyond a manual check of 138
  stores. Its error rate will be a number measured on one corpus, not a bound.
- `CATEGORY_REQUIRES` encodes what audits read, which nothing enforces. It can
  drift the moment an audit starts reading something new.
- §7.5's thresholds ("mostly", "a stated fraction") are unset in this document
  on purpose; they come out of calibration, and writing a number here first
  would be a guess wearing a specification's clothes.
