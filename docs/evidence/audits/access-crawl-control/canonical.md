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
  - google-canonicalization-overview
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

| State                                                           | Result                                      |
| :-------------------------------------------------------------- | :------------------------------------------ |
| ≥ 2 non-root pages declare the **site root** as their canonical | `fail`, priority `high` — homepage collapse |
| a canonical does not resolve to an http(s) URL                  | `fail`, priority `high`                     |
| most declaring pages collapse onto one non-root URL             | `warn`, priority `high`                     |
| a page carries two conflicting canonicals                       | `warn`, priority `medium`                   |
| a canonical names another domain                                | `warn`, priority `medium`                   |
| some pages do not declare one, and every declared one is sound  | `pass`, naming the pages without one        |
| every page that declares one resolves to itself                 | `pass`                                      |
| no page declares a canonical in `<head>`                        | `na` — nothing to judge                     |
| no pages scanned                                                | `na`                                        |

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Googlebot reads `<link rel="canonical">`, and uses it as a strong signal when choosing which of a set of duplicate URLs to index and consolidate signals onto. The URL it selects is the one eligible to be shown in Search — and so, in turn, as a supporting link in AI Overviews and AI Mode.

**Grade: A** — a named crawler's use of the signal is stated in vendor documentation, and the link relation itself is a registered, published standard.

**Evidence:**

- Google describes `rel="canonical"` as "a strong signal that the specified URL should become canonical". It explains the effect: "It helps search engines to be able to consolidate the signals they have for the individual URLs (such as links to them) into a single, preferred URL." It also recommends a self-referential canonical on the canonical page — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (verified 2026-08-21)
- RFC 6596, "The Canonical Link Relation" (Informational, April 2012), defines the relation type. It designates "an Internationalized Resource Identifier (IRI) as preferred over resources with duplicative content". That is a published specification behind the attribute, with known consumers — https://www.rfc-editor.org/rfc/rfc6596.html (verified 2026-08-21)
- Google's crawl-budget guidance corroborates the crawling-side effect: "Consolidate duplicate content" to "focus crawling on unique content rather than unique URLs", because otherwise duplicate URLs waste "a lot of Google crawling time on your site" — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget (verified 2026-08-21)
- The link from indexing to AI surfaces is documented: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** Google explicitly states the tag is not required: "none of them are required; your site will likely do just fine without specifying a canonical preference" (https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls, verified 2026-10-17). The signal is a hint, not a directive, and Google may select a different canonical than the one declared. The same page says why: "That's because if you don't specify a canonical URL, Google will identify which version of the URL is objectively the best version to show to users in Search." It also calls the tag "generally not critical" (https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls, verified 2026-10-17). Google's canonicalization overview describes the fallback: Google "chooses the page that, based on the factors (or _signals_) the indexing process collected, is objectively the most complete and useful for search users, and marks it as the canonical" (https://developers.google.com/search/docs/crawling-indexing/canonicalization, verified 2026-10-17). No primary source says a missing canonical costs a site anything. Absence of the tag is therefore not a defect, and the audit does not score it. When no scanned page declares a canonical, the audit is `na`: it grades the canonical's value, and there is no value to grade. When some pages declare one and others do not, only the declared ones are judged, and the pass message names the pages without one. The graded mechanism concerns the canonical's _value_, and that is where the audit fails. Two or more pages that declare the site root as their canonical fail as a homepage collapse, and a canonical that does not resolve to an http(s) URL fails. Most declaring pages collapsing onto one other URL warns at high priority. RFC 6596 is Informational, not Standards Track (https://www.rfc-editor.org/rfc/rfc6596.html, verified 2026-08-21). No AI vendor outside Google names the signal. OpenAI's (https://developers.openai.com/api/docs/bots) and Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mention robots.txt only (both verified 2026-08-21), and Google states no special markup is needed for its generative features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). The audit only reads `<link rel="canonical">` in `<head>`. A canonical sent only in a `Link:` response header is not read, so that site is `na`, as if it declared none.

## Implementation deviations

- The audit fails on a wrong value and does not score absence. Google says a canonical is not required and picks one itself when none is given, but a homepage collapse removes pages from the index. Until 2026-10-17 absence warned, at medium priority when no page declared one and low otherwise. No source documented a cost, so absence became `na` site-wide and a named, unscored note in a pass otherwise.
- `rel` is matched token-wise and case-insensitively. `href` is resolved against the page URL. Non-HTTP schemes are rejected.
- URLs are compared after normalisation: host without `www.`, lower-cased path, no trailing slash.
- Every sampled page is read. Conflicting canonicals on one page and off-domain canonicals are surfaced.
- A canonical outside `<head>` is treated as missing, and the message says why. Google says the element "is only accepted if it appears in the <head> section of the HTML", so it has the effect of no canonical, which Google documents as fine.
- A relative canonical that resolves to the page itself passes. Google accepts relative canonicals.
- The `Link: rel="canonical"` header form is not read. A header-only site is `na`, as if it declared none.
- A client-injected canonical stays a finding, at `warn`. The major AI crawlers do not execute JavaScript.
- A single page canonicalising elsewhere is not reported; pagination does this legitimately. Collapse needs two pages onto the site root, or at least half of the declaring pages (two or more) onto one other URL.
- The audit describes the effect through Google's indexing chain. No AI vendor outside Google documents canonical handling.
- `defaultPriority` is `medium`. Homepage collapse and an unusable canonical set a higher priority per result.
