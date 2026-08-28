---
'@forkpoint/agent-lighthouse-core': minor
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

**Eleven audits now decline instead.** `scan-evidence` gains
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
- `access-crawl-control/no-bot-detection` and
  `operability-safety/no-blocking-captcha` do the same, and theirs is the one
  pair a user sees change on an ordinary client-rendered scan — see below.
- `answer-readiness/unique-meta` returned `pass` while its message read
  "uniqueness check not applicable". It now returns `notApplicable` whenever
  the scan holds fewer than two distinct canonical pages — **pass → na on every
  such scan**, not only on a shell. Its dossier's 2026-08-20 code review had
  already recorded this fix as needed.
- `operability-safety/third-party-dom-write-blast-radius` declines a
  zero-origin census on a page that served no readable text. It is one of the
  two whose guard runs under the evidence gate — see below.

**Two weight-1.0 vacuous passes on every client-rendered site.**
`no-bot-detection` and `no-blocking-captcha` both decide by substring search
over `page.fetchResult.body`. A shell's body is a mount point and a bundle, so
both found nothing and said so: `pass "No aggressive bot-detection scripts
found on scanned pages."` and `pass "No blocking CAPTCHA scripts detected on
scanned pages."` — about sites whose Turnstile loader is inside the bundle and
whose forms do not exist in the markup at all. Neither is gated out of that
state: both declare `requires: []` so their wall branch stays reachable behind
a 403, which means the gate cannot decline the case for them.

Both now return `notApplicable` when the scanned page served no readable text.
The wall and detection branches still run first, so a 403 is still reported and
a shell that ships a challenge loader statically is still reported.
`no-blocking-captcha` was the only `operability-safety` check that scored on a
shell, so that category's score on such a scan moves **100 → 0** — which is
what `calculateCategoryScore` returns when a category has nothing assessed, not
a judgement about the site. A shell scan carries no overall score either way.

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

**Measured**, released 3.0.0 to this release, over all 215 audits on the shell
scan state with the evidence gate on — which is how every scan runs:

- runnable **54 → 64**, skipped **161 → 151**
- report-wide statuses **5 pass → 12 pass**, **184 na → 177 na**; fail (11) and
  warn (15) unchanged
- category math on that state: `content-extraction` **0 → 73**,
  `access-crawl-control` **59 → 69**, `operability-safety` **100 → 0**, and the
  weighted roll-up **48 → 46**

**Ten audits widen onto a shell scan, and one narrows.** The ten stop being
skipped before they run. Eight of them then report — `https-enabled`,
`no-nofollow`, `no-redirect-chains`, `robots-ai-group-shadowing`,
`robots-directives`, `language-attribute` (all weight 1.0),
`server-responsiveness` (0.6) and `descriptive-urls` (informative), every one
of them `pass` on the measured shell. The other two enter the run and decline
their own empty result, so they add no credit:
`third-party-dom-write-blast-radius` (0.6) and `no-bot-detection` (1.0).
`https-enabled` and `no-bot-detection` widen for a different reason from the
other eight — their `requires` dropped `origin-reachable` so their wall
findings could be reached — and they are the pair the sibling changeset
describes only in the walled direction. The one that narrows is
`no-blocking-captcha`, `pass → na`.

**A shell scan still reports no overall score, before and after.** The 48 → 46
above is the category roll-up, not what a user sees: a shell gates 0.578 of the
registry's evidence mass, over `GATED_MASS_UNSCORED_THRESHOLD`, so the report
carries `overallScore: null` and `scoreTier: null` either way. What a user sees
change is inside the categories — nine checks that read "not assessed" now
report, seven of them scoring, and one that scored now reads "not assessed" —
and one number in the scan validity block. `ScanValidity` carries no ratio
field, so that share reaches a user only as the percentage inside
`unscoredReason`: **"could not feed 64% of the registry's evidence mass"**
becomes **"…58%"**, because the ten take 8.2 of the registry's 134.0
non-informative mass out of the gated set. It stays far above the 0.35
threshold, so the null score is not at risk. What they report is true of what
the site served; what changed is that the scan stops withholding it.

`third-party-dom-write-blast-radius` keeps a guard for the half a shell cannot
support: same-origin resources are discarded from the census, a shell's script
tags are its own bundle, and the vendors an agent meets are injected by that
bundle at runtime — which its own `found` string already says the census does
not count. A zero-origin census on a page that served no readable text returns
`notApplicable` rather than certifying that nothing but the site writes what an
agent reads. Every origin the served HTML does name is still reported.

The seven guards in the first group are not visible in a gated scan of a
shell — those audits still declare `rendered-body`, so the gate skips them
before `audit()` runs, and no production report reaches either their guard or
the reporting branches above it. What the guard buys is a correct verdict when
the audit is called directly, which is how the contract suite calls it, and
when a caller sets `enforceEvidenceGate: false`. The ordering within each — an
instruction planted in a shell's `<title>` or `og:*` value still fails
`aria-layer-injection-scan`, a Unicode Tags run in a robots.txt served beside a
shell still fails `unicode-covert-channel-scan` — is pinned by tests and is
what those audits do under a direct call, not what a gated scan reports.
`unique-meta`'s change is the one in that group with no such condition: it
moves on every scan holding fewer than two distinct canonical pages.

Found by `packages/core/src/tests/hostile-state-contract.test.ts`, which runs
every audit that reads a scanned page against a shell built from the real
`buildScanEvidence` and forbids `pass`. It selects that population from the
source rather than from `requires`: an audit exempted from `rendered-body`
because its subject is the wall was, by declaration alone, excused from the one
test that would have caught its vacuous pass — which is exactly how
`no-bot-detection` and `no-blocking-captcha` shipped theirs.
