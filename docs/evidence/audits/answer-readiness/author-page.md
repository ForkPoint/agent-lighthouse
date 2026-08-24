---
audit: answer-readiness/author-page
audit_id: "10.3"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/author-page.ts
slug: author-page
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# author-page (`10.3`)

> generative-engine · source `author-page.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI engines follow author page links to verify credentials and build author expertise profiles. A dedicated author page strengthens E-E-A-T signals.

## Code review findings (2026-08-20, 11-agent pass)

The underlying idea — a linked author page that actually resolves — is sound link-integrity checking. The implementation is the most dangerous in the category because it performs a live fetch on whatever URL the first loose selector happens to yield, then reports a hard FAIL with author-credibility language when that fetch is anything but 200. `[class*="author"] a` sweeps up social-share icons, mailto links and `#` anchors, so the audit routinely fetches x.com (403 bot wall) or a `mailto:` URL and tells the user their author page is broken.

**Required fix:** 1) Restrict candidates to same-origin http(s) URLs; drop `mailto:`/`tel:`/`javascript:` and pure-fragment or self-referential hrefs before they enter `authorUrls`. 2) Prefer JSON-LD `author.url`, fall back to `a[rel="author"]`, and either drop the `[class*="author"] a` sweep or narrow it to hrefs matching `/author|/authors|/team|/people/`. 3) De-duplicate and check up to N candidates, passing if any resolves, instead of betting on index 0. 4) Treat 403/429 as `warn` ("could not verify — blocked") not `fail`, and short-circuit to `notApplicable` when `ctx.wafProtection` indicates a challenge. 5) Sniff the fetched body for a soft-404 the way publication-date.ts already sniffs XML, and consult `finalUrl`. 6) Return `notApplicable()` when the site has no authored content pages.

**False-positive risks:**
- `$('a[rel="author"], [class*="author"] a')` collects every anchor inside any container whose class contains "author". On a standard byline card `<div class="author-box">` with follow icons, the first collected href is often `https://twitter.com/jane` or `mailto:jane@site.com`. `new URL('mailto:jane@site.com', p.url)` succeeds so it lands in `authorUrls`; only `authorUrls[0]` is ever fetched; `ctx.fetch` on a mailto throws → 'Failed to fetch author page' FAIL on a site with a perfectly good author page.
- `href="#"` or `href="#author-bio"` resolves via `new URL` to the article's own URL. The audit fetches the article, gets 200, and reports 'Author page at "https://site.com/blog/post" returns 200' — a false PASS where no author page exists.
- Social profile URLs that do get fetched (x.com, linkedin.com, instagram.com) return 403/429/999 to non-browser clients. The audit reports 'Author page returned HTTP 403 … agents will flag the author as unverifiable' — a false FAIL caused entirely by a third party's bot wall, with no allowance for the URL being off-domain.
- Only `authorUrls[0]` is checked and the array is built by iterating pages then DOM order, so which URL lands at index 0 depends on page ordering — the verdict is effectively nondeterministic across re-scans of a multi-page site.
- Author pages behind the same CDN/WAF as the rest of the site return 403 to the scanner UA while rendering fine for users. `ctx.wafProtection` is on CheckContext and unused, so a Cloudflare-challenged site gets a confident 'author page is broken' FAIL.
- `[class*="author"]` is case-sensitive and class-name dependent — `class="Author"`, CSS-Modules hashes, or a Tailwind-only byline yield nothing → 'No author page links found' on a site whose bylines link correctly.
- `applicablePageTypes: ['content']` does not filter pages: an author link found on the homepage satisfies the audit; conversely a store, docs site or SaaS landing page with no authored content gets a hard FAIL instead of `notApplicable`.
- The shallow local `findJsonLdByType` misses `mainEntity`/`isPartOf`-nested Article and `@id`-referenced Person nodes.
- No verification that the fetched page is really an author page — a soft-404 shell returning 200 passes, and `finalUrl` (a redirect to the homepage) is never inspected.

**Test gaps:**
- No test for a `mailto:` href inside `[class*="author"]` — the confirmed false-fail path.
- No test for `href="#"` resolving to the page itself — the confirmed false-pass path.
- No test for an off-domain social URL returning 403.
- No test for a WAF/challenge response (`ctx.wafProtection` set).
- No test for redirects — `FetchResult.finalUrl` exists and is never consulted.
- No test for a soft-404 (200 + 'Page not found') passing as an author page.
- No test for ordering nondeterminism across multiple pages with different author URLs.
- The test 'covers catch block when page URL is invalid' sets `page.url = ':::not-a-valid-url:::'`, a state the orchestrator can never produce.

**Overlaps with:** `10.1`, `10.2`

## Evidence

### Signal: Named author with credentials, author pages, and sameAs identity links — grade C (geo-authority)

**Mechanism:** A page carrying a named human author with stated credentials, a linked author/bio page, and schema.org Person sameAs links to external identity references (Wikidata, LinkedIn, ORCID) is more likely to be selected and cited by AI answer engines than an otherwise-identical page with no byline.

**Evidence:** The identity half of this signal is genuinely documented — just not by any AI engine. Google's Search Quality Rater Guidelines (11 Sept 2025, verified by direct PDF read) structure Page Quality around content-creator identity: §2.5.2 'Finding Who is Responsible for the Website and Who Created the Content on the Page', §3.3.4 'Reputation of the Content Creators', §4.5.1 'Inadequate Information about the Website or Content Creator', §5.5 'Unsatisfying Amount of Information about the Website or Content Creator'. Google's helpful-content doc states verbatim: 'We strongly encourage adding accurate authorship information, such as bylines to content where readers might expect it' and asks 'Do pages carry a byline, where one might be expected?'. Google's Article structured-data doc documents author.name, author.url ('a web page that uniquely identifies the author of the article... an "about me" page, or a bio page') and offers sameAs as an alternative for author disambiguation. schema.org's ratified sameAs term is defined as 'URL of a reference Web page that unambiguously indicates the item's identity.' Because Google states AI Overviews run on core Search with no special optimization, these quality signals plausibly reach AIO source selection transitively. Audit value is real: a byline plus resolvable Person markup is cheap, standards-conformant, and carries no downside.

**Counter-evidence:** No AI vendor documents author credentials as a citation input. Anthropic's crawler doc (verified) contains zero guidance on content selection — no mention of authorship, credentials, dates, schema or authority. Google's own AI-features doc says 'There are no additional requirements to appear in AI Overviews or AI Mode' and 'There's also no special schema.org structured data that you need to add.' The GEO paper's nearest analogue, the 'Authoritative' rewrite, scored 21.3 vs 19.3 baseline (+10.4% PAWC) and the authors conclude: 'to the contrary we find no significant improvement, demonstrating that Generative Engines are already somewhat robust to such changes.' The 2026 critical survey states authority signals including authorship and E-E-A-T credentials are 'not systematically studied' and that authority/credibility effects are 'weak and unstable'. Ahrefs' 75K-brand study measured no author-level variable at all, and Semrush's 5M-cited-URL technical study did not test author markup. Every claim that sameAs-attributed authors 'perform better in AI retrieval' traces to vendor marketing blogs with no published methodology. Grade C, not B: plausible mechanism, real standards adoption, zero controlled evidence of an AI-citation effect.
**Consumers:** Google Search (documented: author markup for Article rich results and author disambiguation; content-creator reputation is central to human quality rating), none-known for AI-citation selection specifically · **Recommended tier:** informative

**Sources:** [Google Search Quality Rater Guidelines (General Guidelines), September 11, 2025](https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf) (verified 2026-08-20) · [Creating Helpful, Reliable, People-First Content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) (verified 2026-08-20) · [Article (Article, NewsArticle, BlogPosting) Structured Data](https://developers.google.com/search/docs/appearance/structured-data/article) (verified 2026-08-20) · [schema.org: sameAs property](https://schema.org/sameAs) (verified 2026-08-20) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20) · [GEO: Generative Engine Optimization (Aggarwal, Murahari, Rajpurohit, Kalyan, Narasimhan, Deshpande)](https://arxiv.org/abs/2311.09735) (verified 2026-08-20) · [Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023–2026)](https://arxiv.org/html/2607.14035v1) (verified 2026-08-20) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) (verified 2026-08-20) · [An Analysis of AI Overview Brand Visibility Factors (75K Brands Studied)](https://ahrefs.com/blog/ai-overview-brand-correlation/) (verified 2026-08-20) · [How Do Technical SEO Factors Impact AI Search? [Study]](https://www.semrush.com/blog/technical-seo-impact-on-ai-search-study/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
