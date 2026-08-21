---
check: snippet-gate-coverage-analysis
title: "Snippet-Gate Coverage Analysis"
domain: answer-selection-forensics
status: proposed
evidence_grade: A
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Snippet-Gate Coverage Analysis

> Proposed check. Evidence grade **A** · partial overlap · implementation: `static-fetch`

## What it checks

Computes the site's effective snippet permissions per crawler — merging <meta name="robots">, per-bot meta tags, and X-Robots-Tag response headers — then measures those permissions against the page's actual answer content: is max-snippet numerically smaller than the primary answer span, and does data-nosnippet coverage overlap the answer span, the FAQ answers, or the main-content tables. Reports the specific suppressed text, not just the directive.

## Claimed mechanism (falsifiable)

Google states the eligibility gate directly: to appear as a supporting link a page 'must be indexed and eligible to be shown in Google Search with a snippet', and names nosnippet, data-nosnippet, max-snippet and noindex as the controls that limit what AI Overviews and AI Mode can show (S4). This makes the causal chain fully documented rather than inferred: a max-snippet value shorter than the answer sentence truncates the answer below usefulness, and data-nosnippet wrapping the answer removes it from AI surfaces entirely while leaving it visible to humans — an invisible failure that page-level SEO reports do not surface because the directive itself is technically 'valid'.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Competitor coverage

Screaming Frog, Sitebulb and Semrush all report meta robots and X-Robots-Tag directives — the parsing half is commodity. What none of them do is resolve per-bot precedence into an effective policy, then measure the numeric max-snippet budget against the character length of the page's actual answer span, or compute what fraction of main content sits inside data-nosnippet subtrees and whether those subtrees contain the FAQ answers or the spec tables. Reporting 'max-snippet:60 present' is not the same finding as 'max-snippet:60 truncates your 184-character answer at the word "depends"'.

## Implementation sketch

Static fetch, one request. 1) Parse every <meta name="robots">, <meta name="googlebot">, and other per-bot meta tags, plus all X-Robots-Tag response headers including per-bot forms (`X-Robots-Tag: googlebot: max-snippet:0`). Resolve to an effective directive set per bot using the documented most-restrictive-wins precedence, and report the resolution, since conflicting meta-versus-header directives are a common silent bug. 2) Hard fail on noindex or nosnippet for any AI-relevant agent. 3) Collect data-nosnippet subtrees; compute nosnippetCoverage = characters inside them / main-content characters. Fail if coverage > 0.20, or if any subtree contains the first sentence after an h2, a JSON-LD FAQPage answer, or a main-content <table> — and name the suppressed span in the finding. 4) If max-snippet is a positive integer, compare it to the character length of the primary answer span (first sentence after h1 or after the first h2); fail when the budget is shorter, and show the truncation point. 5) Cross-check consistency: a page carrying FAQPage or HowTo JSON-LD while also carrying nosnippet is a self-defeating configuration and should be reported as a single combined finding.

## Example failure

A publisher sets `<meta name="robots" content="max-snippet:80">` site-wide to discourage scraping, then invests in FAQPage markup. Every answer span on the site runs 150-250 characters, so the AI-surface snippet budget cuts each answer roughly at its midpoint, mid-clause. Separately, a support site wraps its answer bodies in `<div data-nosnippet>` inherited from an old 'prevent snippet theft' template — nosnippetCoverage is 0.71 and every acceptedAnswer is inside it, so the pages are indexed, visibly correct to humans, and structurally invisible to AI Overviews.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
