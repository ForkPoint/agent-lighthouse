# Hostile-state testing and a real-page corpus — design

Status: draft
Date: 2026-08-27
Area: `packages/core/src/tests`, `packages/core/test-data`, `scripts`, one new
workflow

## 1. Problem

The suite is large and it is green. It is also blind in one specific direction,
and three defects shipped through it this month.

Current state, measured on 2026-08-27:

```
Tests       4515 passed | 239 skipped
Statements  96.65%   Branches 88.55%   Functions 97.3%
Corpus      3 hand-written HTML files, 16K total
```

Coverage is not the gap. Every one of the three defects ran through covered
lines and returned a verdict the tests accepted.

| Defect | Why the suite missed it |
| :----- | :---------------------- |
| `getMainContentText` read the first `<main>`, failing two real storefronts at critical priority | Every fixture ships one clean `<main>` holding text. Real pages ship empty ones, and several of them. |
| `no-blocking-captcha` passed sites that had refused the scanner | No test runs an audit against a scan that fetched nothing. |
| A scan that read nothing still printed a score | No test asserts a scan-level invariant. Per-audit tests cannot reach one. |

One root cause covers all three: audits are tested against HTML the audit
author wrote, in the single scan state where every fetch succeeded. The author
writes the page that demonstrates the check. Nobody writes the page that breaks
it, because nobody has met that page.

Two defences follow, and they are independent. Part A tests the states. Part B
supplies the pages.

## 2. Part A — the hostile-state contract

### 2.1 Shape

One registry-driven suite at
`packages/core/src/tests/hostile-state-contract.test.ts`, modelled on
`audit-result-contract.test.ts`, which already loops every registration in
`defaultConfig.audits` and asserts a schema-level property per audit.

Registry-driven is load-bearing. `expectNotApplicableOnEmpty` is a good
contract, and 73 of 222 audit test files call it, because calling it is the
author's job and the author forgets. A suite that reads the registry covers
every audit whether or not anyone remembered.

### 2.2 The states

Each state is a `CheckContext` builder in a shared helper module.

| State | What the scan holds |
| :---- | :------------------ |
| `blocked` | A bot wall. No pages. Root files answered 403. `wafProtection.isBlocked` set, `isRateLimit` false. |
| `throttled` | HTTP 429 on everything. No pages. `isRateLimit` true. |
| `redirected-away` | The homepage landed on a different registrable domain. |
| `non-html` | The homepage served `application/pdf`. |
| `shell` | One page fetched, `<body><div id="root"></div></body>`. Root files answered normally. |

The first four are the states the evidence gate now marks unscored. They are
exactly the states in which an audit has the least to go on and the most
freedom to invent.

### 2.3 The invariants

Two tiers, because the claim is not the same in both.

**Nothing-obtained** — `blocked`, `throttled`, `redirected-away`, `non-html`.
No audit may return `pass`. The scan holds no evidence about the site, so no
audit may congratulate it. `notApplicable` is right, and `fail` is right when
the missing response is itself the finding, which is what
`no-blocking-captcha` now reports. Only `pass` is forbidden.

**Degraded** — `shell`. Only audits that declare `rendered-body` in `requires`
are held to the no-pass rule. A robots-based audit passing here is correct:
`robots.txt` was fetched and read. Narrowing by `requires` rather than by
category keeps the rule tied to what the audit itself says it needs.

**Universal** — in every state, an audit must not throw, and its result must
satisfy `AuditResultSchema`. The runner turns a throw or a rejection into a
`scan-error` stub, so both make the audit report nothing at all.

### 2.4 Exceptions

An audit that can reach a verdict from the request itself, rather than from any
response, may pass in a state where nothing was fetched. No such audit is known
today — `access-crawl-control/https-enabled` was the obvious candidate and it
already requires a 200 homepage before it passes — so the allowlist starts
empty and exists for the case that appears.

Exceptions live in one allowlist, each entry carrying a one-line reason,
following `GATE_EXEMPTIONS` in `scripts/lib/requires-analysis.mjs`. An audit
absent from the list is held to the rule. If the list grows past a handful,
that is evidence the rule is wrong, not that the audits are special.

### 2.5 Scan-level invariants

Three tests in the orchestrator suite, which no per-audit test can reach:

- A scan of a JS shell reports `overallScore === null`.
- A scan of a walled site reports `overallScore === null`.
- `recommendations` never contains a check whose status is `na`.

## 3. Part B — a real-page corpus

### 3.1 The site list

The benchmark list is 138 sites and nearly all of them are Shopify
storefronts. That is one shape of page, tested deeply. News sites, docs,
SaaS marketing pages, government portals, banks, marketplaces, forums,
CJK-language pages and heavy SPAs are all absent, and each of them breaks a
different assumption.

The list is regenerated from public ranked sources rather than typed by hand:

- **Tranco** — a research-grade ranked domain list, built to resist the
  manipulation that affects raw traffic rankings.
- **Chrome UX Report top origins** — origins ranked by real user traffic, in
  public rank buckets.

The output is `packages/core/test-data/sites/`: categorised JSON, each entry
carrying its domain, category, source and rank bucket. It is a repo artifact
with a regeneration script, not a static file that rots.

### 3.2 Tiering

The list is large. Its uses are not equally expensive, so they are tiered.

**Tier 1 — frozen fixtures, about 40 pages.** Committed to
`packages/core/test-data/corpus/real/` as gzipped HTML, read through
`node:zlib`. Real page HTML runs 100 KB to 2 MB; gzip cuts that roughly
tenfold, so 40 pages stay near 1–2 MB in git. Nothing is stripped: an audit
that reads inline scripts must see the inline scripts.

Selection is by measurement, not by taste. Capture a wide sample, then keep the
pages that produce distinct verdict vectors, so the corpus covers shapes rather
than logos. The shapes already known to matter are the ones that broke things:
`velasca.com` (one empty `<main>`), `hiutdenim.co.uk` (four `<main>`, first a
stub), `gymshark.com` (a one-word body), `tattly.com` (20 words), and a
Kasada wall response body.

**Tier 2 — the live list, nightly.** URLs only, no HTML in git. Runs in a
scheduled workflow, never in `pnpm test`.

### 3.3 Capture

`scripts/capture-fixture.ts <url>` fetches once, writes the gzip, and records
provenance: URL, capture date, body SHA-256. Fixtures are never re-fetched, so
CI stays offline and deterministic. A fixture is a measurement with a date on
it, and the date is part of the record.

### 3.4 The fixture test

The full registry runs against each fixture page, and a compact map of audit id
to status is snapshotted. 215 audits across about 40 pages is a large snapshot,
and that is the point: an audit change that silently flips a verdict on a real
page arrives as a reviewable diff instead of shipping.

The cost is honest — any real audit change touches the snapshot, so review
discipline carries it. If churn proves unmanageable, the fallback is to
snapshot only the audits whose status changed against a pinned baseline.

## 4. The nightly job

A scheduled workflow scans the tier 2 list and asserts invariants only. There
is no ground truth for hundreds of third-party sites, so it cannot assert
verdicts. It can assert that nothing crashed, every result satisfied the
schema, no audit passed vacuously, and sites that served readable pages
received a score.

Constraints, from the GitHub Actions limits for a public repository:

- Standard GitHub-hosted runners are free for public repositories with no
  minute cap, so runtime cost is not a constraint.
- A job is capped at 6 hours. At the measured scan rate — 15 to 60 seconds per
  site, concurrency 2, a 3-second delay between sites — 500 sites is about 2
  hours. Beyond roughly 1,000 sites the job must shard across a matrix; the
  Free plan allows 20 concurrent jobs and a matrix allows 256.
- Artifact storage on the Free plan is 500 MB. Full reports for 500 sites
  exceed that, so the job uploads a summary and not the raw reports.
- Scheduled workflows in a public repository are disabled automatically after
  60 days without repository activity, and scheduled runs can be delayed under
  load. "Nightly" is approximate, which this use tolerates.

The job keeps the politeness settings the benchmark already uses — concurrency
2, a delay between sites, `robots.txt` respected. It scans third-party origins,
and doing that from a shared runner pool is only acceptable while it stays
gentle.

## 5. Order

Part A first. It needs no fixtures, it is one suite plus a helper, and it finds
bugs on its own. Part B feeds it real inputs afterwards. The nightly job is
last, because it is worth little until both contracts exist to be run.

## 6. Out of scope

- **Mutation testing.** Stryker would find assertions that never fail, but it
  is slow and part A recovers most of the same signal here at a fraction of the
  cost.
- **Rewriting the 222 per-audit test files.** They stay as they are. The
  contract suites sit above them.
- **Replacing the live-site suite.** `verify-scan-results.test.ts` keeps its
  current role.
