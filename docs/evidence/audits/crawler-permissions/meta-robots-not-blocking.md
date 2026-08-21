---
audit: crawler-permissions/meta-robots-not-blocking
audit_id: "2.25"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/meta-robots-not-blocking.ts
slug: meta-robots-not-blocking
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# meta-robots-not-blocking (`2.25`)

> crawler-permissions · source `meta-robots-not-blocking.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Pages with <meta name="robots" content="noindex"> are hidden from all search engines, including AI-powered ones. Ensure your important content pages do not have this tag.

## Code review findings (2026-08-20, 11-agent pass)

The underlying signal is real and important — `noindex` genuinely removes a page from AI-accessible indexes — but the implementation both misses the common ways sites apply it and fires on legitimate uses. It reads only `page.meta['robots']`, so `X-Robots-Tag: noindex` (the standard HTTP-header form, and how CDNs, staging environments and non-HTML assets apply it) is invisible: false PASS on genuinely deindexed sites. It also ignores `nosnippet` and `max-snippet:0`, which permit indexing but forbid quoting — the directives that most directly prevent a page being cited in AI Overviews or ChatGPT answers, exactly what this tool exists to measure. In the other direction, it fails the entire audit at high priority if ANY scanned page carries noindex, so a crawl that happens to include `/cart`, `/login`, `/search?q=` or a thank-you page — all correctly noindexed — yields 'blocking AI crawlers from indexing'. Its own `expected` string says 'No noindex directive on primary content pages', but the code never reads `page.pageType`; stated criterion and implementation disagree.

**Required fix:** Read `page.fetchResult.headers['x-robots-tag']` in addition to the meta tag, and parse both for `noindex`, `nosnippet`, `noarchive` and `max-snippet:0`. Collect ALL robots meta tags per page rather than last-wins, and apply the most restrictive. Check bot-specific meta names (`googlebot`, `gptbot`) alongside `robots`. Scope the FAIL to pages whose `pageType` is primary content; report noindex on utility pages as informational. Tokenize on commas and trim rather than raw `includes`.

**False-positive risks:**
- Only `page.meta['robots']` is read — `X-Robots-Tag` response headers are never inspected, despite `page.fetchResult.headers` being available. False PASS on header-deindexed sites.
- `robotsContent.includes('noindex')` ignores `nosnippet`, `max-snippet:0`, `noarchive` and `noai`/`noimageai`, which suppress AI citation without blocking indexing. The audit passes a page AI cannot quote.
- Bot-specific meta names are ignored: `<meta name="googlebot" content="noindex">` and `<meta name="GPTBot" content="noindex">` are stored under their own keys by `extractMetaTags` and never checked.
- `extractMetaTags` does `meta[name.toLowerCase()] = content` — last tag wins. A page with `noindex` in the static head and a later hydrated/plugin-injected `index, follow` tag reports only the last; real crawlers apply the MOST RESTRICTIVE directive, so this is a false PASS on a genuinely noindexed page.
- Any single noindexed utility page (cart, login, search results, paginated archive, thank-you) fails the whole audit at high priority with 'blocking AI crawlers' language.
- `expected` promises 'primary content pages' but `ctx.pages` is iterated without consulting `page.pageType` — the audit cannot deliver what it claims to measure.
- SSR/SPA divergence: the scanner sees the server HTML; a client-injected robots meta tag is neither detected nor excluded, so verdicts differ from what a JS-executing agent sees.

**Test gaps:**
- No `X-Robots-Tag` header fixture.
- No `nosnippet` / `max-snippet:0` / `noarchive` case.
- No `<meta name="googlebot" content="noindex">` bot-specific case.
- No duplicate-robots-meta page (restrictive first, permissive last) exercising the last-wins bug.
- No legitimate utility page (cart/login/search) verifying it does not fail the whole audit.
- No `pageType`-aware assertion despite `expected` naming primary content pages.
- No whitespace/case variants such as `content=" NoIndex , NoFollow "`.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
