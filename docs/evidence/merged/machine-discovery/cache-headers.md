---
audit: machine-discovery/cache-headers
audit_id: "8.11"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/cache-headers.ts
slug: cache-headers
review_verdict: merge
severity: medium
evidence_grade: B
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# cache-headers (`8.11`)

> technical-readiness · source `cache-headers.ts` · review verdict **merge** · evidence grade **B** · disposition: **merge (approved 2026-08-21)**

## What it checks

Add Cache-Control headers to AI-facing files to improve performance and reduce unnecessary requests.

## Code review findings (2026-08-20, 11-agent pass)

Checks whether /llms.txt and /openapi.json carry any `cache-control` header. Two problems. First, the value is never examined — `if (file.headers['cache-control'])` passes on `no-store`, `private, max-age=0`, or `no-cache`, i.e. exactly the headers that force the re-fetching the audit exists to prevent; and since Cloudflare, Netlify, Vercel and Fastly attach a cache-control header to essentially every response, most CDN-fronted sites pass for free while origin-hosted sites with a sensible `max-age` set only on assets fail. Second, the benefit is to the site owner's bandwidth, not to any AI agent outcome — an agent that re-fetches llms.txt still gets the content. It is the weakest-value audit in the category that isn't outright wrong.

**Required fix:** Merge into 8.10 as one 'AI file delivery' audit reporting Content-Type + caching + CORS per file. If merged, parse the directive properly — treat `no-store`/`no-cache`/`max-age=0` as NOT caching, accept `ETag`/`Last-Modified` as an equivalent validator path — and make missing files `notApplicable()`. Standalone, it should at minimum stop passing `no-store` and drop to informational weight.

**False-positive risks:**

- Value ignored: `no-store` / `max-age=0` pass. The audit reports 'All AI files have Cache-Control headers' for a configuration that guarantees the exact re-fetch behavior it warns about — a directly inverted result.
- CDN freebie: any site behind a major CDN gets a cache-control header on every response regardless of intent, so the audit mostly measures 'is there a CDN', not 'is caching configured'.
- Absence penalized: `checked === 0` ⇒ `warn` (0.5). Combined with 8.8 and 8.10 doing the same, a site with no llms.txt is docked three times over for one absence.
- `ETag`/`Last-Modified` — the other half of HTTP caching, and the mechanism that actually saves a re-download via conditional requests — are not considered, so a site doing correct validator-based caching without cache-control is failed.
- Only two paths; /llms-full.txt, /.well-known/*, and sitemaps are ignored despite being fetched.

**Test gaps:**

- No test for `no-store` / `max-age=0` (currently pass — the inverted result).
- No test for ETag/Last-Modified-only caching.
- No test that `checked === 0` should be `na`.
- No test for a CDN-injected header (`cache-control: public, max-age=0, must-revalidate`), the most common real value.

**Overlaps with:** `8.10`, `8.8`

## Evidence

### Signal: Cache headers and conditional requests for crawlers (ETag, Last-Modified, 304) — grade B (technical-infra)

**Mechanism:** Correctly implemented ETag/If-None-Match and Last-Modified/If-Modified-Since handling, returning 304 Not Modified for unchanged resources, reduces the cost of each crawl and lets a crawler spend its capacity budget on more distinct URLs. FALSIFIABLE FORM: enabling conditional-request support on a large site increases the number of distinct URLs crawled per period without increasing origin load.

**Evidence:** Documented first-party by Google, whose crawling infrastructure feeds both Search and Gemini/AI-Overviews grounding. Google supports ETag/If-None-Match and Last-Modified/If-Modified-Since 'exactly as defined in the HTTP Caching standard', recommends ETag as less error-prone, and uses ETag when both are present. The crawl-budget guide is explicit about the payoff: returning 304 'tells Google to reuse the cached version, saving your server bandwidth and resources', and a 304 with no body means the server 'doesn't have to spend compute resources on generating content or transfer the HTTP body'. Google's status-code documentation confirms 304 propagates a content-unchanged signal downstream. MCP's authorization spec independently instructs authorization servers to 'cache metadata respecting HTTP cache headers', showing agent protocols also defer to HTTP caching.

**Counter-evidence:** Two real caveats. (1) Google hedges its own claim: 'Individual Google crawlers and fetchers may or may not make use of caching, depending on the needs of the product' — so even within Google the behaviour is not uniform. (2) NO AI-specific crawler vendor documents conditional-request support: OpenAI's bots page, Anthropic's crawler article and Perplexity's crawler docs are all silent on caching. Vercel's data points the other way for freshness — they observed that even when asked for fresh Next.js docs, ChatGPT and Claude often did not fetch at all, implying reliance on cached or training data rather than well-behaved revalidation. So score this as efficiency/hygiene evidenced through Google, and do not claim GPTBot or ClaudeBot honour ETags.
**Consumers:** Googlebot / Google crawling infrastructure (Search, AI Overviews, Gemini grounding), MCP authorization servers, unknown for GPTBot/ClaudeBot/PerplexityBot · **Recommended tier:** scored

**Sources:** [Crawling December: HTTP caching](https://developers.google.com/search/blog/2024/12/crawling-december-caching) · [Google Crawler (User Agent) Overview — crawling infrastructure](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [How HTTP status codes, and network and DNS errors affect Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) · [Model Context Protocol Specification (2025-11-25) — Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `machine-discovery/ai-file-delivery` (Plan 4, 2026-08-22) — [merged dossier](../../audits/machine-discovery/ai-file-delivery.md)
