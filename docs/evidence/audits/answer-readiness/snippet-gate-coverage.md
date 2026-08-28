---
audit: answer-readiness/snippet-gate-coverage
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/snippet-gate-coverage.ts
slug: snippet-gate-coverage
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S4
---


# Snippet-Gate Coverage Analysis

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Computes the site's effective snippet permissions per crawler, by merging <meta name="robots">, per-bot meta tags and X-Robots-Tag response headers. It then measures those permissions against the page's actual answer content. Is max-snippet numerically smaller than the primary answer span? And does data-nosnippet coverage overlap the answer span, the FAQ answers, or the main-content tables? Reports the specific suppressed text, not just the directive.

## Claimed mechanism (falsifiable)

Google states the eligibility gate directly: to appear as a supporting link, a page 'must be indexed and eligible to be shown in Google Search with a snippet'. It names nosnippet, data-nosnippet, max-snippet and noindex as the controls that limit what AI Overviews and AI Mode can show (S4). This makes the causal chain fully documented rather than inferred. A max-snippet value shorter than the answer sentence truncates the answer below usefulness. data-nosnippet wrapping the answer removes it from AI surfaces entirely, while leaving it visible to humans. That failure is invisible to page-level SEO reports, because the directive itself is technically 'valid'.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Competitor coverage

Screaming Frog, Sitebulb and Semrush all report meta robots and X-Robots-Tag directives — the parsing half is commodity. What none of them do is resolve per-bot precedence into an effective policy, then measure the numeric max-snippet budget against the character length of the page's actual answer span, or compute what fraction of main content sits inside data-nosnippet subtrees and whether those subtrees contain the FAQ answers or the spec tables. Reporting 'max-snippet:60 present' is not the same finding as 'max-snippet:60 truncates your 184-character answer at the word "depends"'.

## Implementation sketch

Static fetch, one request. 1) Parse every <meta name="robots">, <meta name="googlebot">, and other per-bot meta tags, plus all X-Robots-Tag response headers including per-bot forms (`X-Robots-Tag: googlebot: max-snippet:0`). Resolve to an effective directive set per bot using the documented most-restrictive-wins precedence, and report the resolution, since conflicting meta-versus-header directives are a common silent bug. 2) Hard fail on noindex or nosnippet for any AI-relevant agent. 3) Collect data-nosnippet subtrees; compute nosnippetCoverage = characters inside them / main-content characters. Fail if coverage > 0.20, or if any subtree contains the first sentence after an h2, a JSON-LD FAQPage answer, or a main-content <table> — and name the suppressed span in the finding. 4) If max-snippet is a positive integer, compare it to the character length of the primary answer span (first sentence after h1 or after the first h2); fail when the budget is shorter, and show the truncation point. 5) Cross-check consistency: a page carrying FAQPage or HowTo JSON-LD while also carrying nosnippet is a self-defeating configuration and should be reported as a single combined finding.

## Example failure

A publisher sets `<meta name="robots" content="max-snippet:80">` site-wide to discourage scraping, then invests in FAQPage markup. Every answer span on the site runs 150-250 characters, so the AI-surface snippet budget cuts each answer roughly at its midpoint, mid-clause. Separately, a support site wraps its answer bodies in `<div data-nosnippet>`, inherited from an old 'prevent snippet theft' template. nosnippetCoverage is 0.71, and every acceptedAnswer is inside it. The pages are therefore indexed, visibly correct to humans, and structurally invisible to AI Overviews.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **Repeated `X-Robots-Tag` field lines required a fetcher fix.**
  `packages/core/src/fetcher.ts` previously dropped every non-string header
  value, so a response sending the header twice reached audits as a single
  line — or none. It now combines repeated field lines with `", "` per
  RFC 9110 §5.3 (`Set-Cookie` excepted, kept newline-separated because its own
  values may contain commas), pinned by two cases in
  `packages/core/src/fetcher.test.ts`.
- **Bot attribution after combination is a within-line reading.** A `bot:`
  prefix scopes the directives that follow it until the next prefix. Once field
  lines are combined, line boundaries are gone, so an unprefixed directive that
  originally stood on its own line is attributed to the last named bot. The full
  parsed directive list is reported in `found` so a human can adjudicate.
- **Crawlers evaluated:** the generic rule plus `googlebot`, `google-extended`,
  `bingbot`, and any crawler a directive on the page names. Resolution is
  most-restrictive-wins: any blocking token, or `max-snippet:0`, gates the page;
  `max-snippet:-1` is unlimited.
- **One combined finding.** `FAQPage` / `HowTo` markup on a page that also
  forbids snippets is reported inside the snippet-gate finding, not as a second
  finding, because it is one configuration mistake.
- The primary answer span is the first sentence after the `h1`, else after the
  first `h2`, else the first paragraph of the main content.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the first scanned page's snippet directives,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the four nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Deferred

- `unavailable_after` is parsed and reported but not evaluated against the
  current date.
- Per-bot `max-snippet` budgets are reported; the truncation comparison runs
  against the generic rule, since that is the budget every unnamed crawler gets.
