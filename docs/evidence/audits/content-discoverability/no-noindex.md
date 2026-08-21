---
audit: content-discoverability/no-noindex
audit_id: "1.13"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/no-noindex.ts
slug: no-noindex
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-noindex (`1.13`)

> content-discoverability · source `no-noindex.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
