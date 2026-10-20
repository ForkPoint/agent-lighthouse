# Browser view audits (issue #175)

Status: accepted, option A. Date: 2026-10-20.

## Problem

A browser extension sends a snapshot because the HTTP fetch cannot see the
real page. A gated page returns a wall. A JS-rendered page returns an empty
shell. Before this change only seven audits ran on the snapshot. Every other
DOM audit read the wall or the shell.

## Decision

Two views, kept apart.

- **Crawler view.** The existing score. It describes HTTP evidence only. It
  does not change. A gated page still reports as blocked, which is what a
  crawler that does not run JavaScript receives.
- **Browser view.** The existing `browserAssessment`, with more audits. It
  describes what an agent that drives a real browser would read from the
  supplied DOM.

Option B, replacing the HTTP HTML with the snapshot in the main scan, stays
rejected. It would let the crawler score claim content crawlers never get.

## Eligibility rule

An audit joins `SNAPSHOT_AUDITS` only when all four hold.

1. **It reads the DOM only.** Its source reads `ctx.pages[].$`, parsed
   structured data, meta tags or a11y rule results. It never reads
   `fetchResult`, `rootFiles`, `ctx.fetch`, headers, status, redirects,
   robots policy, timing or another fetched artifact. A snapshot carries none
   of these (`docs/architecture/browser-snapshots.md`).
2. **It judges one page.** Site-wide ratios, cross-page uniqueness and
   sample-size checks are left out. A capture is one page.
3. **Its dossier names a browser-agent consumer.** The grade must rest on a
   documented consumer that reads a rendered page: the Anthropic browser use
   tool (`read_page`, `get_page_text`, `find`, `form_input`), Playwright MCP
   snapshots, Chrome DevTools MCP `take_snapshot`, or browser-use. Audits whose
   proven consumer is a crawler, a search feature or a RAG index stay out.
   Grade C and D audits stay out: nothing documents consuming them. The one
   earlier grade C entry, `operability-safety/profile-autofill-token-coverage`,
   predates this rule, was reviewed in its own dossier and stays.
4. **Its static verdict means the same thing on a snapshot.** No audit that
   needs computed style (`css-rules` gatherer), script execution, or the
   original HTTP body joins.

### Added (26)

Accessibility tree, via the a11y rule engine (14):
`accessible-names`, `aria-attributes`, `aria-hidden-body`,
`aria-relationships`, `aria-roles`, `autocomplete`, `dialog-name`,
`document-title`, `duplicate-id`, `label`, `landmark-unique`,
`nested-interactive`, `presentation-conflict`, `table-headers` (all
`operability-safety/`).

Accessibility tree and forms, via the parsed DOM (4):
`operability-safety/aria-landmarks`, `operability-safety/form-actionability`,
`operability-safety/form-error-messages`,
`operability-safety/native-control-substitution`.

Content structure (8): `content-extraction/main-element`,
`content-extraction/header-footer`, `content-extraction/article-element`,
`content-extraction/aside-element`, `content-extraction/single-h1`,
`content-extraction/sequential-headings`, `content-extraction/fake-headings`,
`content-extraction/data-tables`.

### Considered and left out

- `content-extraction/content-depth`: the graded claim is retrieval and
  embedding depth, a RAG population, not a browser agent.
- `content-extraction/figure-figcaption`, `operability-safety/frame-title`,
  `operability-safety/tabindex`: grade C.
- `machine-discovery/in-content-links`: the documented consumer is a crawler.
- `structured-data/*` beyond the two already eligible: the consumers are
  search features that read crawled HTML, not browser agents.
- `operability-safety/meta-refresh`: a redirect behaviour.
- Audits on the `css-rules`, `extraction`, `text-metrics`, `tokens`, `feeds`,
  `media`, `mcp`, `openapi` or `security` gatherers: they need fetched
  artifacts, computed style or a site-wide sample.

## Reporting

Unchanged in shape. Every browser finding stays informative with weight 0.
`browserAssessment.score` stays `null`. The crawler `overallScore`,
`categories`, `scanValidity` and `conditions` are byte-identical with and
without snapshots. No dossier or policy supports a browser score: there is
no calibrated population and 33 static checks do not measure task success.
The open question in #175 resolves to "findings only" for now.

Report renderers already list every finding in the browser section, so the
new audits need no renderer change. `coverage.eligibleAuditIds` grows from 7
to 33. That is a new value in an existing field: `minor`.

## Accessibility rule results on a snapshot

Fourteen of the added audits read `PageContext.a11yResults`, which the HTTP
path fills with a jsdom pass. The snapshot path now runs the same pass,
`runA11yForHtml`, over the capture HTML, with `runScripts: "outside-only"`
and no resource loading, so no page script runs and nothing is fetched.

`runA11yForHtml` returns an empty map when jsdom fails. On the HTTP path the
audits then read `notApplicable`. On a snapshot that would count as assessed
and claim the page has nothing to check. Instead, when the pass yields no
rule results, each a11y-backed entry records missing evidence for that
capture. The entry carries `a11yRules: true` so the snapshot path knows which
audits depend on the pass.

## Partial, truncated and redacted captures

Unchanged, and they now cover the new audits. A truncated, redacted or
`loading` capture yields no findings: every eligible audit records missing
evidence with the reason, because a partial DOM cannot prove absence. A
capture with no readable static text fails the `rendered-body` gate the same
way. A page-type gate that rejects the capture, an audit error and a DOM work
limit also become missing evidence, never a verdict.

## Out of scope

A browser score, computed styles, shadow roots and frames, action traces,
and the remaining audits. Each later addition needs the same four-part
review.
