---
audit: answer-engine/content-without-clickthrough
audit_id: "9.9"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/content-without-clickthrough.ts
slug: content-without-clickthrough
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# content-without-clickthrough (`9.9`)

> answer-engine · source `content-without-clickthrough.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
