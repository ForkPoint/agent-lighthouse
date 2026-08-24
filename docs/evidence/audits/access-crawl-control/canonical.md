---
audit: access-crawl-control/canonical
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/canonical.ts
slug: canonical
evidence_grade: A
disposition: "rewritten + merged 2026-08-22 (Plan 4, Task 5) — absorbs canonical-url (4.3)"
reviewed: 2026-08-22
sources:
  - google-consolidate-duplicate-urls
  - rfc-6596-canonical
  - google-crawl-budget-docs
  - google-ai-features-trust
  - s18
  - perplexity-crawlers-docs
  - google-ai-optimization-mythbusting
---

# canonical (`1.17`, `4.3`)

> access-crawl-control · source `canonical.ts` · rewritten, absorbs canonical-url (4.3) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

The canonical URL each page **declares**, resolved and compared against the page itself — not merely that a tag is present.

`<link rel="canonical">` is read from `<head>` with `rel` matched token-wise and case-insensitively, so `rel="Canonical"`, `rel=" canonical "` and `rel="shortlink canonical"` all count. Each `href` is resolved against the page URL (`new URL(href, page.url)`), so relative canonicals are unambiguous and a malformed value cannot pass as absolute. Comparison runs on one key — host without `www.`, lower-cased path, no trailing slash, query or fragment.

| State | Result |
| :--- | :--- |
| ≥ 2 non-root pages declare the **site root** as their canonical | `fail`, priority `high` — homepage collapse |
| a canonical does not resolve to an http(s) URL | `fail`, priority `high` |
| most declaring pages collapse onto one non-root URL | `warn`, priority `high` |
| a page carries two conflicting canonicals | `warn`, priority `medium` |
| a canonical names another domain | `warn`, priority `medium` |
| no page declares a canonical | `warn`, priority `medium` |
| some pages do not declare one | `warn`, priority `low` |
| every page resolves to itself | `pass` |
| no pages scanned | `na` |

## Code review findings (2026-08-20, 11-agent pass)

Checks each page for a <link rel="canonical"> with a non-empty href. Presence-only: it never validates the value, so the far more damaging real bug — every page emitting a canonical pointing at the homepage, which actively de-indexes the whole site — scores a perfect PASS, while an SPA that injects a correct canonical via JS scores FAIL.

**Required fix:** Validate the value, not just presence: resolve the href against the page URL and flag (a) canonicals pointing to a different page than the one scanned (especially many-to-one collapse onto '/'), (b) multiple conflicting canonical elements, (c) off-domain canonicals. Match rel case-insensitively and token-wise. Where a page is JS-rendered, downgrade a missing canonical to warn rather than fail.

**False-positive risks:**
- `$('link[rel="canonical"]').attr('href')` — presence only. A site where all pages canonicalize to `https://site.com/` (a classic SPA/template bug that deletes the site from indexes) PASSES with 'All N page(s) have canonical link tags'. The audit is blind to the failure mode that matters most.
- CSS attribute selector `[rel="canonical"]` is value-case-sensitive: `rel="Canonical"` or `rel="canonical "` (trailing space) is treated as missing.
- JS-injected canonicals (React Helmet / next/head in client-rendered routes) are absent from the static HTML → false FAIL for pages that agents with a browser would see as canonical.
- `.attr('href')` returns the FIRST matching element; a page with two conflicting canonicals (a genuine defect) is judged on one and passes.
- Relative canonical hrefs (`href="/page"`) — valid but ambiguous — are accepted without comment.
- Cross-domain canonicals pointing off-site (syndicated content) pass silently, though they can hand attribution to another domain.
- No check that the canonical matches the page's own URL, so self-referential correctness is never verified.

**Test gaps:**
- Every page canonicalizing to the homepage — currently a false PASS on a site-killing bug
- rel="Canonical" / trailing whitespace in the rel value
- Two conflicting canonical tags on one page
- Relative canonical href
- Cross-domain canonical
- JS-injected canonical absent from SSR HTML

**Overlaps with:** `1.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._
## Evidence (2026-08-21)

**Mechanism claim:** Googlebot reads `<link rel="canonical">` and uses it as a strong signal when choosing which of a set of duplicate URLs to index and consolidate signals onto; the URL it selects is the one eligible to be shown in Search and, consequently, as a supporting link in AI Overviews and AI Mode.

**Grade: A** — a named crawler's use of the signal is stated in vendor documentation, and the link relation itself is a registered, published standard.

**Evidence:**
- Google describes `rel="canonical"` as "a strong signal that the specified URL should become canonical" and explains the effect: "It helps search engines to be able to consolidate the signals they have for the individual URLs (such as links to them) into a single, preferred URL." It also recommends a self-referential canonical on the canonical page — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (verified 2026-08-21)
- RFC 6596, "The Canonical Link Relation" (Informational, April 2012), defines the relation type: it designates "an Internationalized Resource Identifier (IRI) as preferred over resources with duplicative content" — a published specification behind the attribute, with known consumers — https://www.rfc-editor.org/rfc/rfc6596.html (verified 2026-08-21)
- Google's crawl-budget guidance corroborates the crawling-side effect: "Consolidate duplicate content" to "focus crawling on unique content rather than unique URLs", because otherwise duplicate URLs waste "a lot of Google crawling time on your site" — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget (verified 2026-08-21)
- The link from indexing to AI surfaces is documented: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** Google explicitly states the tag is not required: "While we encourage you to use these methods, none of them are required; your site will likely do just fine without specifying a canonical preference" (https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls, verified 2026-08-21). The signal is a hint, not a directive — Google may select a different canonical than the one declared — so *absence* of the tag is not a documented defect, which undercuts this audit's presence-only FAIL. RFC 6596 is Informational, not Standards Track (https://www.rfc-editor.org/rfc/rfc6596.html, verified 2026-08-21). No AI vendor outside Google names the signal: OpenAI's (https://developers.openai.com/api/docs/bots) and Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mention robots.txt only (both verified 2026-08-21), and Google states no special markup is needed for its generative features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Note also that the graded mechanism concerns the canonical's *value*; as recorded above, this audit measures only presence, so a site-wide canonical pointing at `/` — the failure mode this mechanism actually warns about — passes.

## The rewrite and the merge (`TODO(rewrite)`, approved 2026-08-21)

Both source audits checked presence and never the value, so both scored a clean pass on the failure mode their own graded mechanism warns about:

- **1.17 canonical-links** (the surviving row) was `$('link[rel="canonical"]').attr('href')` — a site where every page emits `href="https://site.com/"`, the classic CMS/SPA template bug that consolidates the whole site onto one URL, reported "All N page(s) have canonical link tags". Its CSS attribute selector is also value-case-sensitive, so `rel="Canonical"` read as missing, and `.attr()` takes the first of several conflicting tags.
- **4.3 canonical-url** accepted anything whose href `startsWith('http')` — including the literal string `httpfoo` — on `ctx.pages[0]` only, with an exact case-sensitive `l.rel === 'canonical'` comparison.

The rewritten audit does what the rewrite header asks — **resolved hrefs plus homepage-collapse detection** — and with it the required fixes from both reviews: `rel` matched token-wise and case-insensitively; `href` resolved against the page URL instead of prefix-tested; non-HTTP schemes rejected; normalization (`www.`, case, trailing slash) on both sides of the comparison; every page rather than `pages[0]`; conflicting canonicals on one page surfaced instead of silently taking the first; off-domain canonicals surfaced; and a canonical found outside `<head>` reported as missing with the reason, since crawlers only honour the head form.

**The scoring inversion is deliberate.** v1 failed on *absence* and passed on a wrong value. This audit fails on a wrong value and warns on absence, because the graded evidence says exactly that: Google "encourage[s] you to use these methods, none of them are required; your site will likely do just fine without specifying a canonical preference", while the same doc makes the declared canonical "a strong signal" over which URL is indexed — and an indexed URL is the precondition for appearing in AI Overviews or AI Mode. Absence is a missed opportunity; a homepage collapse removes pages from the index.

**Deviations from the reviews:**
- 4.3's review asks for a warn on a *relative* canonical. Resolution removes the ambiguity that warning existed for (and Google accepts relative canonicals), so a relative href that resolves to the page itself now passes. The `httpfoo` case the same review flags is handled by the same change: it is treated as the relative URL it actually is, not as an absolute one.
- Neither review's `Link: <…>; rel="canonical"` HTTP-header form is read. `page.fetchResult.headers` collapses repeated headers, so a header canonical cannot be parsed reliably here; the audit does not claim to cover it, and a header-only site is reported as "no canonical declared" at `warn`, not `fail` — which is why the inversion above matters.
- Both reviews list "SPA that injects the canonical client-side" as a false positive. It stays a finding, for the same reason recorded in `machine-discovery/in-content-links`: the major AI crawlers do not execute JavaScript, so a client-injected canonical is not there for them. It is a `warn`, never a `fail`.
- A *single* page canonicalizing elsewhere is not reported at all — pagination and filtered variants do this legitimately. Collapse needs two pages onto the site root, or a majority of declaring pages onto one other URL.

## Absorbed evidence — canonical-url (4.3)

4.3's dossier is kept verbatim at [merged/access-crawl-control/canonical-url.md](../../merged/access-crawl-control/canonical-url.md) (grade **B**). It carries two independently researched signals for the same mechanism — `rel="canonical"` as a head signal, and canonical consolidation across sitemap, internal links and redirects — and adds the Bing/Copilot consumer alongside Google's, plus the crawl-economics argument (Cloudflare's crawl-to-refer measurements) for why duplicate URL surfaces are expensive for AI crawlers specifically.

Its counter-evidence is the sharper half and is now load-bearing in this audit's design: no AI vendor outside Google documents canonical handling at all, and every claim that "AI retrieval pipelines use canonicals to deduplicate their source lists" traces to SEO-vendor blogs rather than primary documentation. The audit therefore describes the effect through the indexing chain it can evidence, and does not assert that AI crawlers read the tag directly.

### Grade decision: stays **A**

1.17 grades **A** on Google's documented use of the signal plus RFC 6596; 4.3 grades **B**, capped explicitly because "it would be A only if an AI-specific vendor statement existed". The absorbed evidence is the weaker of the two and adds a second index-derived consumer (Bing → Copilot) rather than a new mechanism, so nothing is raised: **A**, `tier: scored`, `weight 1.0` (`weightForGrade('A', 'scored')`).

`defaultPriority` stays `medium` rather than inheriting 4.3's `high`. The high-priority cases — homepage collapse, an unusable canonical — now set their priority per result, and the residual case the default covers is a missing canonical, which the evidence says is not a defect.
## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 1.17 + 4.3 collapse into one rewritten `canonical` (resolved hrefs, homepage-collapse detection).
- 2026-08-22 — rewritten and merged (Plan 4, Task 5); registry 166 → 165.
