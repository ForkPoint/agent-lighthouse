---
'@forkpoint/agent-lighthouse-core': major
---

A page-reading audit no longer congratulates a site whose page rendered no
text, and eight audits that never needed rendered text stop claiming they do.

**What a JS shell is, and why it is not an empty scan.** The page arrives from
the right host, with a 200, a complete `<head>`, real headers and root files
that fetch and parse. What it withholds is the rendered document: the tables,
figures, headings, links, forms and accessible names an audit walks. An audit
whose population lives in the body therefore finds none of it and, unguarded,
reports the absence as cleanliness — "no data tables found", "no fake headings
detected", "no link changes state when it is fetched" — about a body holding
one empty `<div>`. The measured case is `gymshark.com`, whose `<body>` carries
one word.

**Nine audits now decline instead.** `scan-evidence` gains
`scanReadPageText()` and `unreadPageTextReason()`, and each audit consults them
in the branch where it would otherwise have said "found nothing, so nothing is
wrong":

- `content-extraction/data-tables`, `content-extraction/figure-figcaption`,
  `content-extraction/fake-headings`,
  `answer-readiness/content-without-clickthrough`,
  `operability-safety/aria-layer-injection-scan`,
  `operability-safety/unicode-covert-channel-scan` and
  `operability-safety/unsafe-agent-triggerable-affordances` return
  `notApplicable` on a page that served no readable text. **7 pass → na**
  when the audit is called on the shell scan state; no other verdict moves.
- `answer-readiness/unique-meta` returned `pass` while its message read
  "uniqueness check not applicable". It now returns `notApplicable` whenever
  the scan holds fewer than two distinct canonical pages — **pass → na on every
  such scan**, not only on a shell. Its dossier's 2026-08-20 code review had
  already recorded this fix as needed.
- `operability-safety/third-party-dom-write-blast-radius` declines a
  zero-origin census on a page that served no readable text. It is the one of
  the nine that also drops `rendered-body` from `requires`, so its guard is the
  one that runs under the evidence gate — see below.

The guard is placed after each audit's own reporting branches, never before. An
instruction planted in a shell's `<title>` or `og:*` value still fails
`aria-layer-injection-scan`, and a Unicode Tags run in a robots.txt served
beside a shell still fails `unicode-covert-channel-scan`; both orderings are
pinned by tests.

**Eight audits drop `rendered-body` and `sample-adequate` from `requires`, and
that is a scoring change on client-rendered scans.** `check-requires` derives
those keys from the source touching `ctx.pages`, but these read the response
envelope — head markup, response headers, robots.txt, transport timing, the
URL, the script and frame origins — all of which a shell serves in full. Each
is recorded as a gate exemption with its reason:
`access-crawl-control/no-nofollow`, `access-crawl-control/robots-directives`
and `access-crawl-control/robots-ai-group-shadowing` become
`['origin-reachable']`; `access-crawl-control/no-redirect-chains` becomes `[]`;
`content-extraction/language-attribute`,
`content-extraction/server-responsiveness`,
`answer-readiness/descriptive-urls` and
`operability-safety/third-party-dom-write-blast-radius` become
`['origin-reachable', 'unblocked-fetches']`.

The evidence gate is on for every scan — the orchestrator passes
`enforceEvidenceGate ?? true` — so `requires` decides what a shell scan
reports. Measured over all 215 audits on the shell scan state, gate on:

- runnable **56 → 64**, skipped **159 → 151**
- overall score **49 → 63**
- `content-extraction` **0 → 73**, `access-crawl-control` **63 → 70**
- report-wide statuses **7 pass → 14 pass**, **182 na → 175 na**; fail (11) and
  warn (15) unchanged

Five of the eight carry weight 1.0 (`no-nofollow`, `robots-directives`,
`robots-ai-group-shadowing`, `no-redirect-chains`, `language-attribute`), one
carries 0.6 (`server-responsiveness`), one carries 0
(`descriptive-urls`, informative), and
`third-party-dom-write-blast-radius` (0.6) enters the run but declines its own
empty census, so it adds no credit. A site that scans as a shell — a React
storefront, an SPA — therefore sees its score rise across this release, because
six checks it was previously not judged on now report and pass. What they
report is true of what the site served; what changed is that the scan stops
withholding it.

`third-party-dom-write-blast-radius` keeps a guard for the half a shell cannot
support: same-origin resources are discarded from the census, a shell's script
tags are its own bundle, and the vendors an agent meets are injected by that
bundle at runtime — which its own `found` string already says the census does
not count. A zero-origin census on a page that served no readable text returns
`notApplicable` rather than certifying that nothing but the site writes what an
agent reads. Every origin the served HTML does name is still reported.

The seven guards in the first group are not visible in a gated scan of a
shell — those audits still declare `rendered-body`, so the gate skips them
before `audit()` runs. The guard is what makes each audit correct when it is
called directly, which is how the contract suite calls it, and what stops a
vacuous pass if the gate is ever run with `enforceEvidenceGate: false`.
`unique-meta`'s change is the one in that group with no such condition: it
moves on every scan holding fewer than two distinct canonical pages.

Found by `packages/core/src/tests/hostile-state-contract.test.ts`, which now
runs every audit declaring `rendered-body` against a shell page built from the
real `buildScanEvidence`, and forbids `pass`.
