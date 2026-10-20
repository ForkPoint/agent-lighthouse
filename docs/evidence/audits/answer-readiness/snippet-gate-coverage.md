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
  - google-robots-meta-tag
  - google-common-crawlers
  - bing-robots-meta-tags
  - bing-crawlers
  - apple-applebot-docs
  - openai-bots
  - anthropic-crawler-docs
  - perplexity-bots-docs
  - commoncrawl-ccbot
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

- **Which per-bot names are read (verified 2026-10-20).** A directive counts only under a name its crawler's operator documents reading.
  - Google: "Google supports two user agent tokens in the robots meta tag; other values are ignored" — `googlebot` and `googlebot-news`. For the header, a user agent "may optionally" precede the rules — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-10-20). Google-Extended is "a standalone product token" for robots.txt and "doesn't have a separate HTTP request user agent string" — https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers (verified 2026-10-20).
  - Bing: "you can replace the generic name="robots" with name="bingbot"", and each tag "can also be specified as X-Robots-Tag" — https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240 (verified 2026-10-20). Bing's crawler list names no `msnbot` — https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0 (verified 2026-10-20).
  - Apple: `<meta name="applebot" content="nosnippet">` and `X-Robots-Tag: applebot: nosnippet`. "Apple will not use data tagged nosnippet as additional context and up-to-date content when AI models are used to generate output" — https://support.apple.com/en-us/119829 (verified 2026-10-20).
  - OpenAI, Anthropic, Perplexity and Common Crawl document robots.txt controls only — https://developers.openai.com/api/docs/bots, https://support.claude.com/en/articles/8896518, https://docs.perplexity.ai/guides/bots, https://commoncrawl.org/ccbot (all verified 2026-10-20).

## Example failure

A publisher sets `<meta name="robots" content="max-snippet:80">` site-wide to discourage scraping, then invests in FAQPage markup. Every answer span on the site runs 150-250 characters, so the AI-surface snippet budget cuts each answer roughly at its midpoint, mid-clause. Separately, a support site wraps its answer bodies in `<div data-nosnippet>`, inherited from an old 'prevent snippet theft' template. nosnippetCoverage is 0.71, and every acceptedAnswer is inside it. The pages are therefore indexed, visibly correct to humans, and structurally invisible to AI Overviews.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- Repeated `X-Robots-Tag` field lines reach the audit combined with `", "` per RFC 9110 §5.3 (`fetcher.ts`).
- A `bot:` prefix scopes the directives that follow it until the next prefix. Once field lines are combined, an unprefixed directive from its own line is attributed to the last named bot. The full parsed list is reported in `found`.
- Names read: `robots`, `googlebot`, `googlebot-news`, `bingbot` and `applebot`, in a meta tag or as an `X-Robots-Tag` prefix. The list lives in `packages/core/src/robots-meta-names.ts` and is shared with `access-crawl-control/robots-directives`. Crawlers evaluated: the generic rule, `googlebot`, `bingbot`, and any of those names a directive uses. Any blocking token or `max-snippet:0` gates the page. `max-snippet:-1` is unlimited.
- For `applebot` only `nosnippet` and `none` gate the page. Apple documents that it "will not use data tagged nosnippet as additional context and up-to-date content when AI models are used to generate output", and that `none` means "Applebot won't index, snippet, or follow links on the page". Apple documents `noindex` only as keeping the page out of Spotlight and Siri Suggestions, and does not list `max-snippet`, so neither gates Applebot. The Applebot finding uses Apple's wording, not Google's snippet-eligibility language (https://support.apple.com/en-us/119829, verified 2026-10-20).
- A header prefix must start with a letter. The time half of a comma-split `unavailable_after` date (`25 Jun 2010, 15:00:00 PST`) is therefore not read as a bot, and the directive after it stays in scope.
- A directive under a name no operator documents (`gptbot`, `oai-searchbot`, `chatgpt-user`, `claudebot`, `claude-searchbot`, `claude-user`, `perplexitybot`, `ccbot`, `google-extended`, `applebot-extended`, `msnbot`) is listed in `found` as "not evaluated, outside the documented robots names", as is any other unknown prefix such as `yandexbot`. Until 2026-10-20 `google-extended` was evaluated by default, and a header prefix for any crawler gated the page.
- Google allows a header prefix for any of its crawlers, but only `googlebot` and `googlebot-news` are read. A prefix such as `googlebot-image:` is ignored, which can miss a finding but never invents one. Bing documents the header form of its tags but no `bingbot:` prefix as such; the prefix is read as the header form of the documented `bingbot` meta name.
- `FAQPage` or `HowTo` markup on a page that forbids snippets is reported inside the snippet-gate finding, not as a second one.
- The primary answer span is the first sentence after the `h1`, else after the first `h2`, else the first paragraph of the main content.

## Deferred

- The `## Evidence` section cites the MCP Specification Tools page. That source is about MCP tool listing, not snippet controls, so it is likely misplaced. It is left as it stands until a dossier review replaces it.
- `unavailable_after` is parsed and reported but not evaluated against the current date.
- Per-bot `max-snippet` budgets are reported. The truncation comparison uses the generic rule only.
