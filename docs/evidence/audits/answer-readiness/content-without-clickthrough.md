---
audit: answer-readiness/content-without-clickthrough
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/content-without-clickthrough.ts
slug: content-without-clickthrough
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-ai-optimization-mythbusting
  - google-ai-features-trust
  - vercel-rise-of-ai-crawler
  - s18
  - s15
---

# content-without-clickthrough (`9.9`)

> answer-engine · source `content-without-clickthrough.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI answer engines skip teaser content that gates answers behind sign-ups or downloads. Provide substantive answers directly on the page.

## Code review findings (2026-08-20, 11-agent pass)

Fails a page when ≥2 of eight English teaser regexes match anywhere in its main text, on the theory that the page gates its answers. The intent — detect content that is a lead-gen stub — is legitimate and valuable. The implementation never measures the ratio the audit's own copy claims to measure ('teasers dominating the page'): it does a bare presence count over the whole main region, including footers and sidebars. A 3,000-word article with a newsletter signup and a whitepaper link is failed at HIGH priority and told agents 'will never surface your content', which is simply false. This is the most damaging single result in the category.

**Required fix:** Make the check a ratio, matching the copy: compute total main-content words and only fail when teaser matches occur in the top portion of the content AND the page's substantive word count is low (e.g. <300 words), or when the teaser text is a meaningful fraction of the page. Strip header/nav/footer/aside before matching so global CTAs never count, and deduplicate overlapping pattern hits so one module cannot supply both matches. Gate the pattern set on `lang` and return `na` for unsupported languages instead of a clean pass. Detect the 'no server-rendered content' condition once, as its own result, instead of emitting an editorial warning; and choose the low-content probe page by type, excluding /cart, /login, /search. Reuse parser.getWordCount rather than the local copy.

**False-positive risks:**
- No ratio, despite the claim: `if (found.length >= 2) teaserPages.push(...)`. A long, fully self-contained article that ends with a footer CTA ('Subscribe to access our newsletter archive') plus a resources link ('Download the full report') matches two patterns and is failed as gated teaser content. Word count is never consulted on the fail path.
- getMainContentText falls back to `$('body')` when <main> is absent, so global footer/sidebar CTAs — present identically on every page of the site — are counted as that page's teasers. On a themed site this can fail every page at once for markup the author never put in the article.
- Two matches of the same underlying CTA count separately: the pattern list overlaps ('sign up to (see|view|read|access)' and 'register to (access|view|read)' and 'subscribe to (…|unlock)'), so a single signup module offering two phrasings clears the threshold.
- English-only: TEASER_PATTERNS misses 'Jetzt registrieren um', 'Inscrivez-vous pour lire', 'Regístrate para ver'. Non-English sites that ARE fully gated pass clean — the audit is blind exactly where it would be right.
- The low-content warn path judges the site from one arbitrary page: `ctx.pages.find(p => p.pageType !== 'homepage' && …)` takes the first non-homepage page, which may be /cart, /login or /search — pages that legitimately have <50 words — and warns 'Insufficient content to evaluate' for the whole site.
- SPA/CSR: with no JS rendering, virtually every client-rendered site trips the <50-word warn. The homepage exemption acknowledges this problem but only for the homepage; the same emptiness on /product or /blog produces the warning.
- `contentWordCount` duplicates parser.getWordCount with a different <main>-empty fallback, so this audit and every other audit in the category can disagree about the same page's word count.
- The 200-char truncation of `details` can cut mid-URL, leaving evidence the user cannot act on.

**Test gaps:**
- No long, content-rich article with a footer newsletter CTA and a whitepaper link — the primary high-severity false positive, and it would fail today.
- No page without <main> where global footer CTAs are attributed to the article.
- No test where two overlapping patterns match the same single CTA module.
- No non-English gated page (the false negative).
- No /cart, /login or /search page being selected as the low-content probe.
- No empty-SPA-shell page other than the homepage.
- No test comparing the teaser text length against total content length — because no such ratio exists in the code.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** Answer text that only appears after a sign-up, form submission, or file download is absent from the HTML that AI crawlers fetch, so an answer engine has nothing to extract or cite from that page; a page whose fetched body contains only a teaser contributes no citable content.

**Grade: B** — the mechanism follows from documented crawler behavior and a documented eligibility rule, but no vendor doc or study measures gating (still less teaser-phrase density) against citation rate, and the detector's actual signal is an invented proxy.

**Evidence:**
- Google states the input set for its generative answers: "Google Search generative AI models use publicly accessible, crawlable content to learn patterns and provide relevant, grounded responses" — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (verified 2026-08-21)
- The snippet-eligible text is the ceiling on what AI surfaces can use: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet". The same page names the levers: "To limit the information shown from your pages in Search, use `nosnippet`, `data-nosnippet`, `max-snippet`, or `noindex` controls". Google confirms those controls apply to AI features, because they are built into Search — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- Crawler telemetry shows the gate is never opened. Across Vercel's network, "none of the major AI crawlers currently render JavaScript". ChatGPT and Claude crawlers "do *fetch* JavaScript files (ChatGPT: 11.50%, Claude: 23.84% of requests), they don't *execute* them". Any answer revealed only by a client-side unlock is therefore invisible to them — https://vercel.com/blog/the-rise-of-the-ai-crawler (verified 2026-08-21)
- OpenAI documents its crawlers as plain fetchers — OAI-SearchBot to "surface websites in search results in ChatGPT's search features", GPTBot for training-data crawling, ChatGPT-User "for certain user actions in ChatGPT and Custom GPTs" — with no form-filling, authentication or download capability described — https://developers.openai.com/api/docs/bots (verified 2026-08-21)

**Counter-evidence:** Gating does not by itself remove a page from the index. Google documents a supported paywalled-content path. Marking the gated section with structured data "helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies". Publishers who want the paywalled sections crawled and indexed are advised to "make sure Googlebot and Googlebot-News if applicable, can access your page" (https://developers.google.com/search/docs/appearance/structured-data/paywalled-content). So a properly marked subscription page can be both gated to humans and fully citable — the mechanism holds for lead-gen teasers, not for gating in general. Separately, nothing in vendor documentation or the literature links teaser-phrase density to citation rate: the detector's threshold of two matching English phrases from a hand-written list, and its 50-word warn threshold, have no documented basis and no adoption evidence — graded on their own those specific rules are D. The grade attaches to the gating mechanism, not to this detector. All URLs verified 2026-08-21.
