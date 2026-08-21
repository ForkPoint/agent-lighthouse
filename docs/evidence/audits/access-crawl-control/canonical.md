---
audit: access-crawl-control/canonical
audit_id: "1.17"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/canonical.ts
slug: canonical
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# canonical-links (`1.17`)

> content-discoverability · source `canonical-links.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Canonical link tags tell AI crawlers which URL is the authoritative version of a page, preventing duplicate content issues.

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Googlebot reads `<link rel="canonical">` and uses it as a strong signal when choosing which of a set of duplicate URLs to index and consolidate signals onto; the URL it selects is the one eligible to be shown in Search and, consequently, as a supporting link in AI Overviews and AI Mode.

**Grade: A** — a named crawler's use of the signal is stated in vendor documentation, and the link relation itself is a registered, published standard.

**Evidence:**
- Google describes `rel="canonical"` as "a strong signal that the specified URL should become canonical" and explains the effect: "It helps search engines to be able to consolidate the signals they have for the individual URLs (such as links to them) into a single, preferred URL." It also recommends a self-referential canonical on the canonical page — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (verified 2026-08-21)
- RFC 6596, "The Canonical Link Relation" (Informational, April 2012), defines the relation type: it designates "an Internationalized Resource Identifier (IRI) as preferred over resources with duplicative content" — a published specification behind the attribute, with known consumers — https://www.rfc-editor.org/rfc/rfc6596.html (verified 2026-08-21)
- Google's crawl-budget guidance corroborates the crawling-side effect: "Consolidate duplicate content" to "focus crawling on unique content rather than unique URLs", because otherwise duplicate URLs waste "a lot of Google crawling time on your site" — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget (verified 2026-08-21)
- The link from indexing to AI surfaces is documented: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** Google explicitly states the tag is not required: "While we encourage you to use these methods, none of them are required; your site will likely do just fine without specifying a canonical preference" (https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls, verified 2026-08-21). The signal is a hint, not a directive — Google may select a different canonical than the one declared — so *absence* of the tag is not a documented defect, which undercuts this audit's presence-only FAIL. RFC 6596 is Informational, not Standards Track (https://www.rfc-editor.org/rfc/rfc6596.html, verified 2026-08-21). No AI vendor outside Google names the signal: OpenAI's (https://developers.openai.com/api/docs/bots) and Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mention robots.txt only (both verified 2026-08-21), and Google states no special markup is needed for its generative features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Note also that the graded mechanism concerns the canonical's *value*; as recorded above, this audit measures only presence, so a site-wide canonical pointing at `/` — the failure mode this mechanism actually warns about — passes.
