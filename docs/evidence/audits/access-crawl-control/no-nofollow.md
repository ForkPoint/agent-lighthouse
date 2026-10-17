---
audit: access-crawl-control/no-nofollow
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-nofollow.ts
slug: no-nofollow
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Applebot (explicitly documents nofollow and none directives)
  - Googlebot → AI Overviews / AI Mode (nofollow/sponsored/ugc as hints)
signals:
  - name: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal
    grade: A
    domain: discovery-infra
sources:
  - applebot-doc
  - google-rel-ugc
  - google-ai-features-trust
  - s18
  - anthropic-crawler-docs
  - perplexity-crawlers-docs
---

# no-nofollow (`1.14`)

> content-discoverability · source `no-nofollow.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads page-level `nofollow` in robots metadata and X-Robots-Tag headers on each
scanned page. Applebot documents that this directive stops link traversal on that
page. The audit does not inspect individual anchors or prove that linked pages
cannot be discovered through other sources.

## How it scores

- No scanned pages: `notApplicable`.
- No scanned page carries the directive: `pass`.
- Some scanned pages carry the directive: `warn`.
- Every scanned page carries the directive: `fail`.

The sample is the selected pages, not the whole site. Page order does not change
the result or the representative affected URL. Evidence lists up to five sorted
URLs and the number of additional affected pages. Long evidence text is bounded
by the result schema.

## Limits

The current predicate still uses substring matching for `nofollow`. It does not
recognize `none`, resolve named-bot directives, or exempt legitimate utility
pages. These limits remain pending. The finding asks for a policy review, not
removal of every intentional restriction. Metadata and response headers remain
checkable when the page body has no readable text.

## Evidence

### Signal: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal — grade A (discovery-infra)

**Mechanism:** A page-level <meta name="robots" content="nofollow"> (or 'none') stops documented AI-serving crawlers from following any link on that page; per-link rel="nofollow" is treated by Google as a hint that links 'will generally not be followed'. Applying either to internal navigation therefore reduces discovery of the linked pages. Falsifiable: if pages linked only from nofollowed internal links are crawled and indexed at the same rate as normally linked pages, the claim fails.

**Grade: A** — Apple's Applebot documentation names the behaviour directly. Among the supported robots meta directives it lists "nofollow: Applebot won't follow any links on the page" and "none: Applebot won't index, snippet, or follow links on the page". Both are honoured in the `X-Robots-Tag` header as well. A named agent, a named directive and a stated consequence is grade A. The grade covers the **page-level** directive only. Apple says nothing about `rel="nofollow"` on individual anchors, and Google treats that attribute as a hint whose links "will generally not be followed" — so flagging a single per-link `nofollow` cannot cite this evidence, and the audit does not.

**Evidence:** Apple's current Applebot documentation is unambiguous and names the behavior directly: among supported robots meta directives it lists 'nofollow: Applebot won't follow any links on the page' and 'none: Applebot won't index, snippet, or follow links on the page'. Applebot also supports these via the X-Robots-Tag HTTP header, and falls back to Googlebot's robots.txt rules when Applebot is not named — so Google-targeted directives leak into Apple's AI-grounding crawl. Google's own link-qualification documentation states that links marked nofollow, sponsored or ugc 'will generally not be followed'. Since Google's AI features require the target page to be 'indexed and eligible to be shown in Google Search with a snippet', suppressing traversal to a page suppresses its AI eligibility by the same chain established in signal 1. Two major vendors documenting the consumer behavior in their own crawler docs is what grade A requires.

**Counter-evidence:** Two significant qualifications. First, Apple's documented nofollow is the PAGE-LEVEL meta robots directive, not per-link rel="nofollow" — most audits conflate these, and Apple's docs say nothing about the rel attribute on individual anchors. An audit that flags a single rel="nofollow" internal link cannot cite the Applebot page as support. Second, Google demoted nofollow from directive to hint in September 2019. It states plainly that 'the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled'. So nofollow does not reliably prevent discovery even for Google. OpenAI, Anthropic and Perplexity documentation is entirely silent on nofollow, with no evidence GPTBot, ClaudeBot or PerplexityBot honors it in either form. Scope the audit to meta robots nofollow/none on indexable pages, and treat per-link rel=nofollow on internal navigation as a weaker informational finding.

## Implementation deviations

- `requires` is `origin-reachable` and `unblocked-fetches` only. The audit reads `<meta name="robots">` and the `X-Robots-Tag` header, which a page whose body renders nothing still serves whole. The exemption is recorded in `scripts/lib/requires-analysis.ts`.
- The title and guidance describe a page-level directive and its documented Applebot consumer, not individual links or site-wide invisibility.

## Deferred

- Replace substring matching with directive-aware parsing, including `none` and
  bot-specific scope.
- Establish utility/indexable-page eligibility from supported purpose evidence.
  Preserve intentional restrictions. Whole-sample severity stays as it is until
  that population review has its own tests and evidence.
