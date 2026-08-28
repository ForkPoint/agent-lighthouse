---
audit: answer-readiness/descriptive-urls
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/descriptive-urls.ts
slug: descriptive-urls
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search (documented as a crawlability/comprehension best practice, explicitly NOT claimed as a ranking factor)"
  - none-known for AI-citation selection
signals:
  - name: Descriptive URLs
    grade: C
    domain: geo-authority
sources:
  - google-url-structure
  - semrush-technical-seo-ai
  - google-ai-features-trust
  - anthropic-crawlers
  - geo-critical-survey-arxiv
---

# descriptive-urls (`10.15`)

> generative-engine · source `descriptive-urls.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI engines use URL text as a content signal. Descriptive slugs help agents understand page topics before fetching the content.

## Code review findings (2026-08-20, 11-agent pass)

Real signal — readable URLs appear in AI citations and do carry pre-fetch topical hints — but the pattern list is wrong in both directions and the audit runs at `defaultPriority: 'high'`. `/%[0-9A-Fa-f]{2}.*%[0-9A-Fa-f]{2}/` flags every percent-encoded non-Latin URL as 'non-descriptive', so a Japanese, Russian, Greek or Arabic site with perfectly descriptive slugs is told at high priority to restructure its URLs. `/\/[a-z]*\/\d+\/?$/i` flags legitimate `/blog/page/2` pagination and `/products/12345` SKU URLs. And a homepage-only scan passes vacuously.

**Required fix:** 1) Decode before testing: run `decodeURIComponent` on the pathname and judge the decoded form — a decoded slug of readable words in ANY script is descriptive. Delete the `%XX.*%XX` pattern entirely. 2) Replace `/\/[a-z]*\/\d+\/?$/` with a rule requiring the numeric segment to be the only meaningful segment (no word-bearing slug anywhere in the path), and explicitly exempt `/page/N` pagination. 3) Use `p.fetchResult.finalUrl ?? p.url` so post-redirect canonical URLs are judged. 4) Anchor the UUID and query-id patterns to the path, not the whole URL. 5) Return `notApplicable()` when the scan discovered only the homepage. 6) Drop `defaultPriority` to 'medium' — URL restructuring is high-cost and high-risk, and the evidence for its AI impact does not justify high-priority framing.

**False-positive risks:**
- `/%[0-9A-Fa-f]{2}.*%[0-9A-Fa-f]{2}/` matches any URL containing two percent-escapes. A descriptive Japanese slug `https://example.jp/%E8%A8%98%E4%BA%8B/%E3%82%BF%E3%82%A4%E3%83%88%E3%83%AB` — which renders as readable Japanese in every browser and in AI citations — is reported as non-descriptive and needing restructuring. Same for Russian, Greek, Hebrew, Thai, Arabic, and Latin slugs with accents (`/café-guide/`). This is the highest-severity defect in the category: confident, high-priority, wrong advice to every non-English site.
- `/\/[a-z]*\/\d+\/?$/i` — `[a-z]*` allows zero characters, so the rule is 'any path ending in /word/digits'. It flags `/blog/page/2` (standard pagination), `/products/12345` (legitimate stable SKU URLs), `/news/2024` (a year archive), `/docs/v2`. None is a defect.
- `/\/\d{5,}\/?$/i` flags stable numeric identifiers that are correct by design — legal document numbers, ISBN/EAN paths, ticket or order references, government record IDs.
- The audit inspects only `ctx.pages`, a small discovered sample. A scan finding only the homepage `https://example.com/` matches nothing and reports 'All 1 scanned page URL(s) use descriptive slugs' — a vacuous PASS on a site whose entire catalogue is `/p/12345`.
- Conversely, if the crawler happens to discover only paginated or product-ID URLs, the site gets 'All scanned page URLs have non-descriptive slugs' at 'high' priority — the verdict is a function of crawler sampling, not site structure.
- `p.url` is the requested URL, not `fetchResult.finalUrl`. A site redirecting `/?p=123` → `/how-to-bake-bread/` is judged on the pre-redirect URL and FAILS despite having exactly the slugs the audit wants.
- The UUID pattern is unanchored, so a UUID anywhere — including an analytics/session query param `?sid=<uuid>` — condemns an otherwise clean path. Likewise `[?&](?:id|p|page_id)=\d+` flags a URL whose path is fully descriptive.

**Test gaps:**
- No test for a percent-encoded non-Latin URL — the highest-impact false positive.
- No test for `/blog/page/2` or `/products/12345`.
- No test for a homepage-only scan producing the vacuous pass.
- No test for a redirect where `finalUrl` differs from `p.url`.
- No test for a UUID confined to a query parameter.
- No test for accented Latin slugs (`/café-guide/`).
- Only 4 tests, one per branch, all with hand-picked English URLs that confirm intent and probe no edges.

**Overlaps with:** _none_

## Evidence

### Signal: Descriptive URLs — grade C (geo-authority)

**Mechanism:** URLs containing readable, hyphen-separated words describing the page's topic increase the likelihood of the page being retrieved and cited by AI answer engines, relative to opaque ID-based URLs.

**Evidence:** Google's URL structure doc gives clear, quotable guidance. First: 'When possible, use readable words rather than long ID numbers in your URLs.' Second: 'Use words in your audience's language in the URL (and, if applicable, transliterated words).' Third: 'We recommend using hyphens (-) instead of underscores (_) to separate words in your URLs.' Semrush analysed 5 million cited URLs across ChatGPT Search and Google AI Mode. Citation counts peak for 21–25 character slugs (~87K citations), with a secondary peak at 6–10 characters. Moderate slug lengths of 17–40 characters consistently outperform very short and very long URLs. Mechanistically a descriptive slug does carry topical tokens that a retriever can match and that a synthesiser can render as meaningful anchor text, so the convention is coherent and costless to follow.

**Counter-evidence:** Google's own doc frames descriptive URLs purely as crawlability and human/machine comprehension, and makes no ranking claim whatsoever — it says only that they help 'Google Search (and your users) better understand your site'. The Semrush slug data is a distribution over already-cited URLs, with no uncited control group. It therefore cannot separate a URL effect from the confound that well-edited sites both write good slugs and produce citable content. Semrush labels the whole study correlational. No AI vendor documents URL wording as an input to source selection — OpenAI's and Anthropic's publisher-facing docs are silent, and Anthropic's crawler doc contains no content-selection guidance at all. The GEO paper did not test URLs among its nine methods, and the 2026 critical survey does not list URL structure among replicated levers. Google's AI-features doc reiterates there are no special optimizations for AI surfaces. Plausible, conventional, cheap — and entirely unproven as a citation driver.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. `ctx.pages` and `ctx.rootFiles` carry whatever
  answered 200, which on a parked domain is a broker's page served from another
  host and on a walled, throttled or non-HTML origin is nothing about the site
  at all. The audit read them as the site's own and returned a verdict about
  somebody else. It now consults `scanReadTheSite`, the `origin-reachable`
  decision it already names in `requires`, and returns `notApplicable` with the
  gate's reason attached. Found by the hostile-state contract suite.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
