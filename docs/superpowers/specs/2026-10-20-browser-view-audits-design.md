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

### Added (14)

Rule 3 is read strictly: the dossier's own grade reasoning must rest on a
browser-agent tool, and the dossier's `## Browser view` section must quote
that tool's page for this audit's signal, re-fetched and stamped. A
browser consumer named only in `consumers:` or `sources:` does not count.

Accessibility tree, via the a11y rule engine (11): `accessible-names`,
`aria-attributes`, `aria-hidden-body`, `aria-relationships`, `aria-roles`,
`dialog-name`, `duplicate-id`, `label`, `landmark-unique`,
`nested-interactive`, `presentation-conflict` (all `operability-safety/`).

Accessibility tree and forms, via the parsed DOM (3):
`operability-safety/aria-landmarks`, `operability-safety/form-actionability`,
`operability-safety/native-control-substitution`.

### Reviewed and left out

The grade reasoning rests on something other than a browser agent:

- `content-extraction/main-element`, `header-footer`, `article-element`,
  `aside-element`: the grade rests on trafilatura and Readability source, an
  extractor population.
- `content-extraction/single-h1`, `fake-headings`: the grade rests on
  LangChain's HTML splitters, a RAG population.
- `content-extraction/sequential-headings`: the dossier states that every
  splitter and accessibility-tree snapshot examined tolerates a skipped
  level. A browser-view finding would contradict it.
- `operability-safety/document-title`: the grade rests on Google title links
  and WCAG 2.4.2, a search-feature and standards path.
- `content-extraction/data-tables`, `operability-safety/table-headers`: the
  grade leans on Readability, and the re-fetched Playwright snapshot page does
  not mention tables.
- `operability-safety/autocomplete`: token validity serves browser autofill;
  no browser-agent tool documents reading the token.
- `operability-safety/form-error-messages`: no browser-agent tool documents
  reading the error description wired by `aria-errormessage` or
  `aria-describedby`.
- `content-extraction/content-depth`: retrieval and embedding depth, a RAG
  population.

Grade C, or a crawler or search consumer:

- `content-extraction/figure-figcaption`, `operability-safety/frame-title`,
  `operability-safety/tabindex`: grade C.
- `machine-discovery/in-content-links`: the documented consumer is a crawler.
- `structured-data/*` beyond the two already eligible: search features.
- `operability-safety/meta-refresh`: a redirect behaviour.

Deferred, each a candidate for a later review against its dossier:

- `agent-interfaces/webmcp-declarative-forms`: experimental tier, and
  Chrome's attribute reading is a browser feature rather than an agent tool.
- `operability-safety/drag-and-slider-dependency`: the grade rests partly on
  a benchmark measurement, which needs its own reading.
- `operability-safety/aria-layer-injection-scan`: a safety check whose
  consumer claim needs separate review.

Out by construction: audits on the `css-rules`, `extraction`,
`text-metrics`, `tokens`, `feeds`, `media`, `mcp`, `openapi` or `security`
gatherers. They need fetched artifacts, computed style or a site-wide sample.

### Entries that predate the rule

The first seven entries were reviewed in their own dossiers before this
rule. `json-ld-present` and `schema-validation` claim only that parsed
structured data is present in the captured DOM, with no consumer claim.
`profile-autofill-token-coverage` is grade C. They stay; their dossiers now
carry a `## Browser view` section with an audit-specific lead.

## Reporting

Unchanged in shape. Every browser finding stays informative with weight 0.
`browserAssessment.score` stays `null`. The crawler `overallScore`,
`categories`, `scanValidity` and `conditions` are equal with and without
snapshots, in a shell crawl, a JS-rendered capture and a scored crawl with
failing browser findings. No dossier or policy supports a browser score: there is
no calibrated population and 21 static checks do not measure task success.
The open question in #175 resolves to "findings only" for now.

Report renderers already list every finding in the browser section, so the
new audits need no renderer change. `coverage.eligibleAuditIds` grows from 7
to 21. That is a new value in an existing field: `minor`.

## Accessibility rule results on a snapshot

Eleven of the added audits read `PageContext.a11yResults`, which the HTTP
path fills with a jsdom pass. The snapshot path now runs the same pass,
`runA11yForHtml`, over the capture HTML, with `runScripts: "outside-only"`
and no resource loading, so no page script runs and nothing is fetched.

`runA11yForHtml` returns an empty map when jsdom fails. On the HTTP path the
audits then read `notApplicable`. On a snapshot that would count as assessed
and claim the page has nothing to check. Instead, when the pass yields no
rule results, each a11y-backed entry records missing evidence for that
capture. The entry carries `a11yRules: true` so the snapshot path knows which
audits depend on the pass.

The pass runs only on a capture with readable text, and the missing-evidence
record is written after the page-type and evidence gates, so a gated capture
keeps its own reason. The pass shares the process-wide jsdom limit
(`A11Y_CONCURRENCY`) with HTTP scans and is not cancelled while it waits for
a slot.

Before jsdom, `stripStyles` drops `<style>` blocks and stylesheet links. It
was two regexes that rescanned to the end of the input for every unclosed
tag, quadratic on a client-supplied capture. It is now a linear scan with the
same output, for the HTTP path and the snapshot path alike.

## Where the dossier note lives

A dossier's own `## Limits` section turns off the website's promotion of
`**Counter-evidence:**` into Limits. The browser-view note therefore lives
under `## Browser view`, published through `public_extra`, and the real
counter-evidence stays the public Limits. Five older dossiers that had put
the note under Limits moved it the same way.

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

## Deferred

- `stripStyles` closes a `<style>` block only at an exact `</style>`. Browsers
  also accept `</style >` and `</style\n>`. On such input the strip runs on to
  the next exact close and removes the markup between them from the a11y
  pass. The old regexes behaved the same, and the equivalence tests pin that
  behaviour. Accepting `/<\/style\s*>/i` is a separate verdict change.
- The jsdom a11y pass is not cancelled while it waits for an
  `A11Y_CONCURRENCY` slot.
