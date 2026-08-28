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

**Eight audits now decline instead.** `scan-evidence` gains
`scanReadPageText()` and `unreadPageTextReason()`, and each audit consults them
in the branch where it would otherwise have said "found nothing, so nothing is
wrong":

- `content-extraction/data-tables`, `content-extraction/figure-figcaption`,
  `content-extraction/fake-headings`,
  `answer-readiness/content-without-clickthrough`,
  `operability-safety/aria-layer-injection-scan`,
  `operability-safety/unicode-covert-channel-scan` and
  `operability-safety/unsafe-agent-triggerable-affordances` return
  `notApplicable` on a page that served no readable text. **7 pass → na** on
  the shell scan state; no other verdict moves.
- `answer-readiness/unique-meta` returned `pass` while its message read
  "uniqueness check not applicable". It now returns `notApplicable` whenever
  the scan holds fewer than two distinct canonical pages — **pass → na on every
  such scan**, not only on a shell. Its dossier's 2026-08-20 code review had
  already recorded this fix as needed.

The guard is placed after each audit's own reporting branches, never before. An
instruction planted in a shell's `<title>` or `og:*` value still fails
`aria-layer-injection-scan`, and a Unicode Tags run in a robots.txt served
beside a shell still fails `unicode-covert-channel-scan`; both orderings are
pinned by tests.

**Eight audits drop `rendered-body` and `sample-adequate` from `requires`.**
`check-requires` derives those keys from the source touching `ctx.pages`, but
these read the response envelope — head markup, response headers, robots.txt,
transport timing, the URL, the script and frame origins — all of which a shell
serves in full. Each is recorded as a gate exemption with its reason:
`access-crawl-control/no-nofollow`, `access-crawl-control/robots-directives`
and `access-crawl-control/robots-ai-group-shadowing` become
`['origin-reachable']`; `access-crawl-control/no-redirect-chains` becomes `[]`;
`content-extraction/language-attribute`,
`content-extraction/server-responsiveness`,
`answer-readiness/descriptive-urls` and
`operability-safety/third-party-dom-write-blast-radius` become
`['origin-reachable', 'unblocked-fetches']`. **No verdict moves today.** Under
the evidence gate these eight are no longer skipped on a shell scan, where each
holds a sound answer — 8 na stubs → real verdicts, all 8 a pass on the shell
state.

Found by `packages/core/src/tests/hostile-state-contract.test.ts`, which now
runs every audit declaring `rendered-body` against a shell page built from the
real `buildScanEvidence`, and forbids `pass`.
