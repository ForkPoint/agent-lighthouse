---
audit: access-crawl-control/robots-directives
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/robots-directives.ts
slug: robots-directives
evidence_grade: A
disposition: "rewritten + merged 2026-08-22 (Plan 4, Task 5) — absorbs no-noindex (1.13) and meta-robots (4.20)"
reviewed: 2026-08-22
sources:
  - google-robots-meta-tag
  - google-ai-features-trust
  - rfc9309
  - s18
  - perplexity-bots-docs
---

# robots-directives (`2.25`, `1.13`, `4.20`)

> access-crawl-control · source `robots-directives.ts` · rewritten, absorbs no-noindex (1.13) + meta-robots (4.20) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Every robots directive that applies to a scanned page, from both transports and from every directive-carrying meta name:

- `<meta name="robots">` **and** the per-bot forms (`googlebot`, `google-extended`, `gptbot`, `oai-searchbot`, `claudebot`, `applebot-extended`, `bingbot`, `perplexitybot`, …), read off the DOM so *all* tags count rather than the last one;
- the `X-Robots-Tag` response header, including the per-bot `X-Robots-Tag: googlebot: noindex` form.

Values are tokenized on commas and compared token-wise, so `none` is recognised as noindex+nofollow and `noindexifembedded` is not mistaken for a full block.

| State | Result |
| :--- | :--- |
| a **content** page carries `noindex`/`none` | `fail` — `critical` when the homepage is among them, otherwise `high` |
| a content page carries `nosnippet`, `noarchive` or `max-snippet:0` | `warn`, priority `medium` — indexed but unquotable |
| only utility routes (cart, login, search, account, …) carry `noindex` | `pass`, naming them |
| no directive blocks or suppresses | `pass` |
| no pages scanned | `na` |

## Code review findings (2026-08-20, 11-agent pass)

The underlying signal is real and important — `noindex` genuinely removes a page from AI-accessible indexes — but the implementation both misses the common ways sites apply it and fires on legitimate uses. It reads only `page.meta['robots']`, so `X-Robots-Tag: noindex` (the standard HTTP-header form, and how CDNs, staging environments and non-HTML assets apply it) is invisible: false PASS on genuinely deindexed sites. It also ignores `nosnippet` and `max-snippet:0`, which permit indexing but forbid quoting — the directives that most directly prevent a page being cited in AI Overviews or ChatGPT answers, exactly what this tool exists to measure. In the other direction, it fails the entire audit at high priority if ANY scanned page carries noindex, so a crawl that happens to include `/cart`, `/login`, `/search?q=` or a thank-you page — all correctly noindexed — yields 'blocking AI crawlers from indexing'. Its own `expected` string says 'No noindex directive on primary content pages', but the code never reads `page.pageType`; stated criterion and implementation disagree.

**Required fix:** Read `page.fetchResult.headers['x-robots-tag']` in addition to the meta tag, and parse both for `noindex`, `nosnippet`, `noarchive` and `max-snippet:0`. Collect all robots meta tags per page rather than last-wins, and apply the most restrictive. Check bot-specific meta names (`googlebot`, `gptbot`) alongside `robots`. Scope the FAIL to pages whose `pageType` is primary content; report noindex on utility pages as informational. Tokenize on commas and trim rather than raw `includes`.

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page carrying `noindex` in a robots meta tag, or in the equivalent `X-Robots-Tag` header, is excluded from Google's Search index. Google documents that the same family of robots directives governs whether the page can be shown, or used as a direct input, in AI Overviews and AI Mode.

**Grade: A** — the consumer is named in vendor documentation. Google Search Central states that `noindex` removes the page from search results. It states that `nosnippet` and `max-snippet` "will also prevent" or "limit" the content being "used as a direct input for AI Overviews and AI Mode".

**Evidence:**
- Google Search Central, robots meta tag reference. `noindex`: "Do not show this page, media, or resource in search results." `nosnippet`: it "will also prevent the content from being used as a direct input for AI Overviews and AI Mode". `max-snippet:[number]`: it "will also limit how much of the content may be used as a direct input for AI Overviews and AI Mode". The doc scopes these rules to "all forms of search results (at Google: web search, Google Images, Discover, AI Overviews, AI Mode)" — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- Google Search Central, AI features and your website: site owners may use the `nosnippet`, `data-nosnippet`, `max-snippet` or `noindex` controls to limit how their content appears in AI features on Search. Eligibility for AI Overviews and AI Mode carries "no additional technical requirements" beyond ordinary Search eligibility — that is, the AI surfaces are fed by the same Search index that `noindex` removes the page from — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The directive is a long-standing, cross-vendor indexing control rather than a Google-only convention; RFC 9309 governs the robots.txt half of the same exclusion family and is a ratified standard with named crawler consumers — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)

**Counter-evidence:** `noindex` gates *index-derived* surfaces only. User-initiated fetchers are unaffected: OpenAI documents that for `ChatGPT-User` "Because these actions are initiated by a user, robots.txt rules may not apply" (https://developers.openai.com/api/docs/bots), and Perplexity documents that `Perplexity-User` "Generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots) — both verified 2026-08-21. A noindexed page can therefore still be fetched and quoted live in a chat answer, so the audit's failure language ("blocking AI crawlers") overstates the effect for the conversational-agent path. Separately, the strongest AI-specific directives Google names — `nosnippet`, `data-nosnippet`, `max-snippet:0` — are outside what the current implementation reads, so the A-grade mechanism is only partially instrumented.

## The rewrite and the three-way merge (approved 2026-08-21)

The v2 map collapses 2.25, 1.13 and 4.20 into one audit — all three read the same directive family, each through a different keyhole, and all three shipped the same class of false PASS:

- **2.25 meta-robots-not-blocking** (the surviving row) read `page.meta['robots']` only, so `X-Robots-Tag: noindex` — the CDN/staging form — was invisible; and it failed the whole site at `high` when any scanned page carried noindex, so a crawl that included `/cart` reported "blocking AI crawlers from indexing". Its own `expected` string promised "primary content pages" while the code never consulted the page at all.
- **1.13 no-noindex** read the homepage only (`ctx.pages[0]`), so a site that noindexed its entire `/docs` tree passed with "Homepage has no noindex directive".
- **4.20 meta-robots** was `robots.includes('noindex')` on `ctx.pages[0]`: `content="none"` (noindex+nofollow) reported "no blocking directives" at `critical` priority, `noindexifembedded` reported a hard failure, and an empty page list — every fetch failed — reported a critical-priority PASS, a behaviour its test suite explicitly enshrined.

The merged audit executes almost all of the required fixes from the three reviews: every page rather than `pages[0]`; both transports, meta and `X-Robots-Tag`; per-bot meta names *and* per-bot `X-Robots-Tag` syntax, both filtered through the same crawler allowlist so a bot-scoped directive binds only that bot; all robots meta tags collected off the DOM instead of last-wins `page.meta`; comma-tokenized comparison instead of `includes`; `none` recognised, `noindexifembedded` not; the snippet-suppressing family (`nosnippet`, `noarchive`, `max-snippet:0`) reported, since Google names exactly those as the controls that stop content "being used as a direct input for AI Overviews and AI Mode"; utility routes excused; and an empty page list returning `na` instead of a green pass.

**Known gap — repeated `X-Robots-Tag` headers.** 1.13's review asks that `fetcher.ts` be fixed to join repeated headers before the header transport can be trusted, and that fix is not in this audit's scope. `fetcher.ts` keeps only string-typed header values (`if (typeof value === 'string')`), so when a server sends `X-Robots-Tag` more than once the values surface as an array and are dropped entirely — a repeated-header `noindex` is still a false PASS here. What the audit does cover is the single-header case, including its per-bot form. This is the same class of gap that `canonical` records for the `Link: <…>; rel="canonical"` header, and it has the same cause.

**Deviation from the reviews:** two reviews ask that the FAIL be scoped by `page.pageType`. `PageType` cannot carry that decision — its four values (`homepage`, `category`, `product`, `content`) are all primary content — so the content/utility split is made on the URL path (`/cart`, `/checkout`, `/login`, `/account`, `/search`, `/thank-you`, `/wp-admin`, …). A noindexed utility route is reported in the pass message rather than being silently dropped.

**Also deliberate:** the failure copy no longer says "blocking AI crawlers". As the counter-evidence below records, `noindex` gates *index-derived* surfaces; user-initiated fetchers (`ChatGPT-User`, `Perplexity-User`) may still fetch and quote the page live. The message now says the pages are excluded from the index that AI Overviews and AI Mode draw on, which is what the evidence supports.

## Absorbed evidence — no-noindex (1.13) and meta-robots (4.20)

Both absorbed dossiers are kept verbatim at [merged/access-crawl-control/no-noindex.md](../../merged/access-crawl-control/no-noindex.md) (grade **A**) and [merged/access-crawl-control/meta-robots.md](../../merged/access-crawl-control/meta-robots.md) (grade **A**).

1.13 adds the explicit Google chain for the `noindex` token itself — "`noindex` is used to prevent indexing content by search engines that support the `noindex` rule, such as Google", implementable as a meta tag, a per-bot meta tag, *or* an `X-Robots-Tag` header — plus the precondition this audit still cannot see: "For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file."

4.20 adds the two non-Google consumer paths that justify reading the suppressing directives: Apple states that `nosnippet` data is not used "as additional context and up-to-date content when AI models are used to generate output for display in Apple products and services" and that `noindex` keeps a page out of Spotlight and Siri Suggestions; Microsoft states that `NOARCHIVE` content "will not be included in Bing Chat answers". It is also the source of the per-bot meta-name requirement — Applebot honours an `applebot`-scoped meta name and `X-Robots-Tag`.

### Grade decision: stays **A**

All three rows graded **A** independently, on the same proven consumer path (Googlebot → the index that AI Overviews and AI Mode draw on), with 4.20 adding documented Apple and Microsoft paths for the snippet directives. No absorbed evidence is stronger than the survivor's, so nothing is raised and nothing is lowered: **A**, `tier: scored`, `weight 1.0` (`weightForGrade('A', 'scored')`).

`defaultPriority` stays `high` rather than inheriting the absorbed rows' `critical`: `critical` is now emitted per result, and only when the homepage is among the blocked pages — which is exactly the case 1.13 existed to catch.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the robots meta and X-Robots-Tag on the
  scanned pages, and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 —
  on a parked domain a broker's page from another host, on a walled or
  throttled origin nothing at all. It now consults `scanReadTheSite()` and
  returns `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the four nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — `requires` drops `rendered-body` and `sample-adequate` and is now
  `['origin-reachable']`. The directives this audit reads live in meta tags and
  the `X-Robots-Tag` header, which arrive whether or not the body renders, so the
  keys `check-requires` derived from the `ctx.pages` read overstated what the
  verdict depends on. Recorded as a gate exemption in
  `scripts/lib/requires-analysis.mjs`. No verdict changes; under the evidence
  gate the audit is no longer skipped on a JS-shell scan. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (mechanism research pass).
- 2026-08-21 — approved: 2.25 + 1.13 + 4.20 collapse into one rewritten `robots-directives` (all pages, meta + `X-Robots-Tag`, token-parsed).
- 2026-08-22 — rewritten and merged (Plan 4, Task 5); registry 168 → 166. The fold absorbed two rows (1.13 and 4.20) into 2.25, so the registry drops by two, not one.
