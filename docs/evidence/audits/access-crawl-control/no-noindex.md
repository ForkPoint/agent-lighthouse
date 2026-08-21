---
audit: access-crawl-control/no-noindex
audit_id: "1.13"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-noindex.ts
slug: no-noindex
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-noindex (`1.13`)

> content-discoverability · source `no-noindex.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

A noindex directive on your homepage prevents AI crawlers and search engines from indexing your most important page.

## Code review findings (2026-08-20, 11-agent pass)

The highest-value audit in the category — a noindex on the homepage genuinely does remove a site from AI search — and the implementation is basically correct for the case it covers. But it only inspects the homepage and only the generic `robots` directive, so the most common real incidents (noindex on inner pages, bot-specific meta tags, a staging X-Robots-Tag on a subset of routes) are missed entirely, producing confident false passes.

**Required fix:** Check every scanned page, not just pages[0], and report per-page (homepage noindex = critical, inner pages = warn). Recognize `content="none"` and bot-specific meta names (googlebot, gptbot, google-extended, bingbot, applebot-extended). Have `extractMetaTags()` preserve duplicate robots tags rather than overwriting. Fix `fetcher.ts` to join repeated headers instead of dropping non-string values, then parse X-Robots-Tag per-bot properly.

**False-positive risks:**
- Only `page.meta['robots']` is read. Bot-targeted directives — `<meta name="googlebot" content="noindex">`, `name="GPTBot"`, `name="robots" content="none"` (none == noindex+nofollow) — are all missed. 'none' in particular is a silent false PASS.
- `extractMetaTags()` stores `meta[name.toLowerCase()] = content` and later tags overwrite earlier ones, so a page with two robots meta tags is judged on the last one only; a `noindex` in the first tag is invisible.
- Homepage only (`ctx.pages[0]`). A site that noindexes its entire /docs or /blog tree passes with 'Homepage has no noindex directive' — arguably a more damaging real-world scenario than a homepage noindex.
- X-Robots-Tag parsing is a raw substring test on the whole header, so a per-bot header (`X-Robots-Tag: googlebot: noindex`) is treated as a blanket noindex, over-reporting; and multiple X-Robots-Tag headers collapse to one string in the fetcher's `headers` map (only string-typed values are kept — repeated headers surface as an array and are silently DROPPED by `if (typeof value === 'string')`), so a repeated-header noindex is a false PASS.
- JS-injected robots meta (SPA) is invisible to the static parse — false PASS.
- `ctx.pages[0]` is assumed to be the homepage; if the homepage fetch failed, pages[0] is some other page and the message still says 'Homepage'.

**Test gaps:**
- `content="none"` (false PASS today)
- `<meta name="googlebot" content="noindex">`
- Two robots meta tags on one page
- Repeated X-Robots-Tag headers (dropped by the fetcher)
- Per-bot X-Robots-Tag syntax ('googlebot: noindex')
- noindex on inner pages but not the homepage

**Overlaps with:** `1.14`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** A page serving `noindex` (via `<meta name="robots">` or the `X-Robots-Tag` header) is dropped from Google's index by Googlebot and is therefore ineligible to be shown or cited as a supporting link in AI Overviews and AI Mode.

**Grade: A** — Google's documentation states both halves of the chain by name: Googlebot honours `noindex`, and a page must be indexed to be eligible for its AI features.

**Evidence:**
- Google documents the directive and the named crawler that obeys it: `noindex` "is used to prevent indexing content by search engines that support the `noindex` rule, such as Google", implementable as `<meta name="robots" content="noindex">`, `<meta name="googlebot" content="noindex">`, or an `X-Robots-Tag` response header "with a value of either `noindex` or `none`" — https://developers.google.com/search/docs/crawling-indexing/block-indexing (verified 2026-08-21)
- Google ties indexing directly to AI surface eligibility: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet, fulfilling the Search technical requirements", and lists `nosnippet`, `data-nosnippet`, `max-snippet` and `noindex` as the applicable controls — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- Google's AI-optimization guidance confirms the same control surface governs generative features, with no separate opt-in: "AI is built into Search and integral to how Search functions" and no new files or markup are required — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (verified 2026-08-21)
- Same page records the precondition the audit cannot see: "For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file, and it has to be otherwise accessible to the crawler" — https://developers.google.com/search/docs/crawling-indexing/block-indexing (verified 2026-08-21)

**Counter-evidence:** The proven consumer path is Google's. No non-Google AI vendor documents honouring `noindex`: OpenAI's crawler documentation describes robots.txt as the control for OAI-SearchBot, GPTBot and ChatGPT-User and never mentions `noindex` or `X-Robots-Tag` (https://developers.openai.com/api/docs/bots, verified 2026-08-21), and Perplexity documents robots.txt only, noting that Perplexity-User "generally ignores robots.txt rules" because its fetches are user-initiated (https://docs.perplexity.ai/docs/resources/perplexity-crawlers, verified 2026-08-21). So a `noindex` page can still be read and cited by a ChatGPT or Perplexity user-initiated fetch — the signal's proven effect is on Google-index-derived AI surfaces, not on all AI consumers. Google also warns that "some search engines might interpret the `noindex` rule differently" (https://developers.google.com/search/docs/crawling-indexing/block-indexing, verified 2026-08-21).
