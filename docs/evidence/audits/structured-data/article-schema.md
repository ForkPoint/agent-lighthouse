---
audit: structured-data/article-schema
audit_id: "3.6"
category: structured-data
source_file: packages/core/src/audits/structured-data/article-schema.ts
slug: article-schema
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# article-schema (`3.6`)

> structured-data · source `article-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.

## Code review findings (2026-08-20, 11-agent pass)

Article schema genuinely helps AI attribution, but the page-selection logic is wrong in both directions: `pageType === 'content'` is detectPageType's catch-all bucket (so /about, /contact, /privacy are audited as 'blog pages'), and the schema-based fallback fires on any page whose flattened graph contains a hoisted BlogPosting listing stub. Both produce confident false failures with the message 'No Article schema found on N blog page(s)'.

**Required fix:** Stop treating `pageType === 'content'` as 'this is a blog post'. Identify article pages by a positive signal: an Article/BlogPosting node whose `mainEntityOfPage`/`url`/`@id` resolves to the page's own URL, or `og:type === 'article'`, or a `<time datetime>` byline. Ignore hoisted nested Article nodes (require top-level/@graph depth). Score the best Article on the page rather than `articles[0]`, and demote `dateModified` from required to advisory so a complete-but-unmodified article can pass.

**False-positive risks:**
- `if (page.pageType === 'content') return true;` — `detectPageType` returns 'content' as the FALLBACK for anything not homepage/product/category (parser.ts:511). So `/about`, `/contact`, `/privacy-policy`, `/careers`, `/terms` are all classified as blog pages and hard-failed for lacking Article schema. On a brochure site with no blog at all, this audit fails at `high` priority with the message 'No Article schema found on 4 blog page(s)' — the most frequent false fail in the category.
- The schema fallback `schemas.some((s) => matchesAnyType(s, ARTICLE_TYPES))` runs over `flattenJsonLd`, which hoists nested nodes. A blog index or homepage listing recent posts as `"itemListElement": [{"@type":"BlogPosting","headline":"…"}]` is therefore classified as an article page, and those listing stubs never carry `dateModified`/`author`, so the audit reports 'partial' and warns. Standard on WordPress and Shopify blog index pages.
- `const art = articles[0]` scores only the FIRST Article on a page. On a real post page where a related-posts carousel emits stubs before the main Article, the audit scores the stub and warns 'partial' on a complete post.
- `dateModified` is in `requiredProps`, but Google lists it as recommended and evergreen content legitimately omits it. A correctly marked-up Article with headline + datePublished + author can never reach `pass` — it is permanently warned for a legitimate editorial choice.
- `hasProps` uses `!obj[k]`, so `"author": ""` or `"headline": 0` counts as missing (fine) but there is no check that `author` is a usable value — `"author": {}` (empty object) is truthy and passes.

**Test gaps:**
- No test for a non-article 'content' page (/about, /privacy) being wrongly required to carry Article schema — the dominant false fail
- No test for a blog index page whose graph contains hoisted BlogPosting listing stubs
- No test where a related-posts stub precedes the main Article on the same page
- No test asserting `dateModified` absence should not block a pass
- No test for a multi-page scan mixing real posts with legal pages

**Overlaps with:** `3.15`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
