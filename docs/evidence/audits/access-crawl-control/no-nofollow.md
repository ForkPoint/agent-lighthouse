---
audit: access-crawl-control/no-nofollow
audit_id: "1.14"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-nofollow.ts
slug: no-nofollow
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-nofollow (`1.14`)

> content-discoverability · source `no-nofollow.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

A site-wide nofollow directive prevents AI crawlers from following links to discover your content. Important internal links should be followable.

## Code review findings (2026-08-20, 11-agent pass)

Title and guidance promise 'No nofollow on important links' and advise reserving nofollow 'for untrusted external links', but the code never inspects a single anchor — it only reads page-level meta robots / X-Robots-Tag. The user is graded on one thing and advised about another. Marginal value even when fixed: page-level nofollow is rare and, in 2026, a weak lever compared with noindex or robots.txt disallow.

**Required fix:** Either (a) implement what the title says — count `rel="nofollow"` on internal anchors and flag only internal links that are nofollowed — or (b) rename the audit to 'No page-level nofollow directive' and align the guidance text with the code. Add `content="none"` detection, tokenize the directive list instead of substring matching, and exempt known utility page types (login/cart/search) from the count.

**False-positive risks:**
- Implementation/description mismatch: `metaRobots.includes('nofollow')` on page meta only. `rel="nofollow"` / `rel="ugc"` / `rel="sponsored"` on anchors — what the title and fix text describe — is never examined.
- `content="none"` (which implies nofollow) is not detected → false PASS.
- Substring matching on the raw content string: a value like `max-snippet:-1, nofollowups` would match, and per-bot directives are not distinguished.
- Same repeated-X-Robots-Tag drop as 1.13 (fetcher keeps only string-typed header values).
- Legitimate uses are penalized: a login, cart, search-results or paginated page carrying `index,nofollow` is normal practice; the audit surfaces it as an AI-discoverability problem at medium priority.
- Reports 'All N pages have nofollow' as a hard FAIL when N could be 1 (a single-page scan), making a one-page site's normal configuration look site-wide catastrophic.

**Test gaps:**
- rel="nofollow" on internal anchors — the audit's stated subject, entirely untested
- content="none"
- Per-bot nofollow directives
- Utility pages (login/cart) legitimately carrying nofollow
- Single-page scan producing a site-wide FAIL

**Overlaps with:** `1.13`, `1.15`

## Evidence

### Signal: nofollow on internal links / meta robots nofollow suppressing AI crawler link traversal — grade A (discovery-infra)

**Mechanism:** A page-level <meta name="robots" content="nofollow"> (or 'none') stops documented AI-serving crawlers from following any link on that page; per-link rel="nofollow" is treated by Google as a hint that links 'will generally not be followed'. Applying either to internal navigation therefore reduces discovery of the linked pages. Falsifiable: if pages linked only from nofollowed internal links are crawled and indexed at the same rate as normally linked pages, the claim fails.

**Evidence:** Apple's current Applebot documentation is unambiguous and names the behavior directly: among supported robots meta directives it lists 'nofollow: Applebot won't follow any links on the page' and 'none: Applebot won't index, snippet, or follow links on the page'. Applebot also supports these via the X-Robots-Tag HTTP header, and falls back to Googlebot's robots.txt rules when Applebot is not named — so Google-targeted directives leak into Apple's AI-grounding crawl. Google's own link-qualification documentation states that links marked nofollow, sponsored or ugc 'will generally not be followed'. Since Google's AI features require the target page to be 'indexed and eligible to be shown in Google Search with a snippet', suppressing traversal to a page suppresses its AI eligibility by the same chain established in signal 1. Two major vendors documenting the consumer behavior in their own crawler docs is what grade A requires.

**Counter-evidence:** Two significant qualifications. First, Apple's documented nofollow is the PAGE-LEVEL meta robots directive, not per-link rel="nofollow" — most audits conflate these, and Apple's docs say nothing about the rel attribute on individual anchors. An audit that flags a single rel="nofollow" internal link cannot cite the Applebot page as support. Second, Google demoted nofollow from directive to hint in September 2019 and states plainly that 'the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled' — so nofollow does not reliably prevent discovery even for Google. OpenAI, Anthropic and Perplexity documentation is entirely silent on nofollow, with no evidence GPTBot, ClaudeBot or PerplexityBot honors it in either form. Scope the audit to meta robots nofollow/none on indexable pages, and treat per-link rel=nofollow on internal navigation as a weaker informational finding.
**Consumers:** Applebot (explicitly documents nofollow and none directives), Googlebot → AI Overviews / AI Mode (nofollow/sponsored/ugc as hints) · **Recommended tier:** scored

**Sources:** [About Applebot](https://support.apple.com/en-us/119829) · [Qualify Your Outbound Links to Google (nofollow, sponsored, ugc)](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
