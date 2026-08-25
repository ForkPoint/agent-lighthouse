---
audit: machine-discovery/ai-file-delivery
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/ai-file-delivery.ts
slug: ai-file-delivery
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs cache-headers (8.11); informative, weight 0"
reviewed: 2026-08-22
recommended_tier: informative
consumers:
  - browser-based agents (download vs parse behaviour)
  - none-known among server-side crawlers
signals:
  - name: Correct Content-Type for llms.txt and .md files
    grade: C
    domain: technical-infra
  - name: "Cache headers and conditional requests for crawlers (ETag, Last-Modified, 304)"
    grade: B
    domain: technical-infra
sources:
  - llmstxt-spec-link
  - rfc9116
  - s18
  - anthropic-crawlers
  - google-http-caching-blog
  - google-crawl-budget-docs
  - mcp-spec-authorization
  - vercel-rise-of-ai-crawler
---

# ai-file-delivery (`8.10`, `8.11`)

> machine-discovery · source `ai-file-delivery.ts` · absorbs cache-headers (8.11) · evidence grade **B** · tier **informative** (weight 0)

## What it checks

How the AI files the scan already fetched are *delivered* — two headers per file, one audit:

| File | Expected Content-Type |
| :--- | :--- |
| `/llms.txt` | `text/plain` or `text/markdown` |
| `/.well-known/ai-catalog.json` | `application/json` |
| `/openapi.json` | `application/json` (YAML types tolerated) |
| `/sitemap.xml` | `application/xml` or `text/xml` |

A file counts as cacheable when it carries a `Cache-Control` with a non-zero `max-age` and no `no-store`/`no-cache`, **or** an `ETag` / `Last-Modified` validator.

| State | Result |
| :--- | :--- |
| every served file correctly typed and cacheable | `pass` |
| any file mis-typed | `fail`, priority `medium` |
| types correct, some file with no caching headers | `warn`, priority `low` |
| no AI file was served (or the response is the site's HTML shell) | `na` |

At `tier: informative` / `weight 0` none of these outcomes moves a score.

## Code review findings (2026-08-20, 11-agent pass)

The most defensible audit in the category — an llms.txt served as `application/octet-stream` or an OpenAPI doc served as `text/html` genuinely does break downstream parsers, and the check itself (`ct = file.contentType.toLowerCase().split(';')[0].trim()`, then substring match against an allow-list) is sound and correctly tolerant of charset suffixes. The flaw is that it cannot tell a mis-typed file from a file that does not exist: SPA/Jamstack hosts answer unknown paths with 200 + index.html, so `/openapi.json` comes back as `text/html` and the audit reports 'Incorrect Content-Type … expected application/json, got text/html' about a file the site never published. It also silently skips half the AI files the scan already fetched.

**Required fix:** Add a body-shape guard before judging: if the declared type is wrong AND the body parses as the expected shape (JSON.parse succeeds / starts with `<?xml`/`<urlset`), report a genuine mis-typing; if the body is the site's HTML shell (starts with `<!doctype html` or equals the homepage body), treat the file as absent and skip it instead of failing. Extend `expectations` to the other AI files the orchestrator already fetched (llms-full.txt, agents.md, sitemap-index.xml, rss/feed, .well-known/mcp/servers.json). Split the openapi entry so .json expects JSON and .yaml expects YAML. Return `notApplicable()` when `checked === 0`.

**False-positive risks:**
- Soft-404 blindness: `if (!file || file.status !== 200) continue;` treats an SPA catch-all 200 as a real file. Netlify/Vercel/React-Router rewrites → every unpublished AI file is reported as having the wrong Content-Type, with a fix instruction the user cannot act on. This is the single most likely false failure on modern hosting.
- Content is never sampled: a body starting `<!doctype html>` would immediately disprove the 'JSON file with wrong header' reading, but `file.body` is not inspected.
- Coverage gaps: `/llms-full.txt`, `/agents.md`, `/rss.xml`, `/feed.xml`, `/sitemap-index.xml`, `/robots.txt`, `/.well-known/mcp/servers.json` are all fetched by the orchestrator and all skipped here, so a site can mis-serve most of its AI surface and still pass on the four checked paths.
- `application/yaml`/`text/yaml` are accepted for `/openapi.json` — a .json path serving YAML is a real defect being waved through, and the reverse (openapi.yaml) is not checked at all since only /openapi.json is in the list.
- Gzipped sitemaps (`sitemap.xml.gz`, or sitemap.xml served `application/x-gzip`) and `application/rss+xml`-style variants are outside the allow-list.
- Absence penalized: `checked === 0` ⇒ `warn` (0.5) rather than `na`, so sites with no AI files lose points for having nothing to check.

**Test gaps:**
- No test for the SPA 200-HTML fallback — the dominant false-positive case.
- No test for `application/octet-stream` on llms.txt, which is the exact failure the guidance copy describes.
- No test for the un-checked paths (llms-full.txt, agents.md, sitemap-index.xml, feeds).
- No test for gzip/compressed sitemap content types.
- No test that `checked === 0` should be `na` rather than a scored warn.

**Overlaps with:** `8.11`, `8.8`, `8.4`

## Evidence

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

**Mechanism:** The claim under test: serving /llms.txt and .md mirrors as text/plain or text/markdown (rather than text/html, application/octet-stream or a wrong charset) is required for AI consumers to parse them correctly. FALSIFIABLE FORM: a named AI consumer that parses the file when served as text/plain fails to parse the byte-identical file served as application/octet-stream or text/html.

**Evidence:** Convention with sensible precedent, not a documented requirement. RFC 9116 does establish the pattern for well-known plain-text files — security.txt 'must be served as plain text (MIME type text/plain) with UTF-8 encoding'. The llms.txt spec uses type="text/markdown" when describing link relations, so text/markdown is the intent-consistent choice. Two real failure modes are mechanically certain rather than speculative: application/octet-stream triggers download-rather-than-parse behaviour in browser-based consumers, and a Content-Type of text/html on a Markdown file will lead HTML-oriented extraction pipelines to run an HTML parser over Markdown. X-Content-Type-Options: nosniff, where present, removes the browser's ability to recover from a wrong type.

**Counter-evidence:** The llmstxt.org specification states no requirement for the file's own HTTP Content-Type — it only mentions text/markdown in the context of link relations. No AI vendor documentation (OpenAI, Anthropic, Perplexity, Google, Apple) specifies a Content-Type requirement for any AI-facing file. LLM ingestion pipelines are in practice tolerant text extractors; there is no published case of a named crawler rejecting a correctly-named llms.txt on Content-Type grounds. The widely repeated claim that 'some crawlers will refuse application/octet-stream' traces only to SEO blogs, not to any primary source. Grade C: plausible mechanism, partial adoption, unproven effect.

## Absorbed evidence — cache-headers (8.11)

8.11 asked whether `/llms.txt` and `/openapi.json` carry a `cache-control` header. That is the same subject as this audit — how the AI files are served — so the two collapse into one per-file delivery report.

Its dossier is kept verbatim at [merged/machine-discovery/cache-headers.md](../../merged/machine-discovery/cache-headers.md) (grade **B**).

### Signal: Cache headers and conditional requests for crawlers (ETag, Last-Modified, 304) — grade B (technical-infra)

**Mechanism:** Correct `ETag`/`If-None-Match` and `Last-Modified`/`If-Modified-Since` handling, returning `304 Not Modified` for unchanged resources, cuts the cost of each crawl and lets a crawler spend its capacity on more distinct URLs.

**Evidence:** Documented first-party by Google, whose crawling infrastructure feeds both Search and Gemini/AI-Overviews grounding: it supports both mechanisms "exactly as defined in the HTTP Caching standard", prefers ETag, and states that a 304 "tells Google to reuse the cached version, saving your server bandwidth and resources". MCP's authorization spec independently instructs clients to "cache metadata respecting HTTP cache headers".

**Counter-evidence:** Google hedges — "individual Google crawlers and fetchers may or may not make use of caching" — and *no* AI-specific crawler vendor documents conditional-request support: OpenAI's, Anthropic's and Perplexity's crawler docs are silent on caching. Vercel observed ChatGPT and Claude often not fetching at all when asked for fresh docs, implying reliance on cached or training data rather than well-behaved revalidation. The benefit is therefore best stated as efficiency/hygiene evidenced through Google, not as an AI-agent outcome.

### Grade decision: raised **C → B**, tier stays informative (weight 0)

The meta law grades a merged audit on the strongest **proven** path for the merged signal. That signal is now *delivery headers on AI files*, and the caching half is the better-evidenced of the two: the Content-Type claim grades **C** (plausible mechanism, no vendor requirement, "none-known among server-side crawlers"), while the conditional-request claim grades **B** on Google's own first-party documentation of the mechanism it implements — the same transitive Google-index path that earns `discovery-index-coverage` its B.

The tier does **not** follow the grade: the grade prices the evidence and the tier prices the claim. 8.11's review is explicit that the benefit is "to the site owner's bandwidth, not to any AI agent outcome", and that standalone the audit "should at minimum … drop to informational weight". `weightForGrade('B', 'informative') === 0`, so absorbing a `scored`/0.6 audit into an informative one removes 0.6 of machine-discovery's evidence mass — deliberately. A later task that finds an AI consumer documenting conditional requests can promote the tier without re-grading.

### Required fixes — landed 2026-08-22

From 8.11's review:

- **The directive value is parsed.** `if (file.headers['cache-control'])` passed `no-store`, `no-cache` and `max-age=0` — exactly the configurations that force the re-fetching the audit warns about, a directly inverted result. A file now counts as cacheable only with a non-zero `max-age` and no blocking directive.
- **Validators count.** `ETag` / `Last-Modified` — the mechanism that actually saves the download via conditional requests — are accepted as an equivalent path, so a site doing correct validator-based caching without `Cache-Control` is no longer reported as uncached.
- **Absence is `na`.** `checked === 0` scored a `warn`; combined with 8.8 and 8.10 doing the same, a site with no llms.txt was docked three times for one absence.

From 8.10's own review:

- **Soft-404 guard.** A 200 whose body is the site's HTML shell is treated as an unpublished file and skipped, instead of being reported as mis-typed with a fix the user cannot act on — the review calls this "the single most likely false failure on modern hosting".
- **nosniff sub-signal (v2 map row 8.4 → 8.10).** When a mis-typed file is also served with `X-Content-Type-Options: nosniff`, the message says so: nosniff removes a client's ability to recover from the wrong type, which is the one place that header changes a parsing outcome. Homepage-level nosniff hygiene stays in `operability-safety/security-header-hygiene`.

Not addressed by this fold (8.10's remaining backlog): extending the path list to `/llms-full.txt`, `/agents.md`, `/sitemap-index.xml` and the feeds; splitting the openapi entry so `.json` expects JSON and `.yaml` expects YAML; and gzipped-sitemap content types.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — dispositions approved: 8.10 keep-with-fixes, 8.11 merge into it.
- 2026-08-22 — 8.11 folded in, grade raised C → B at tier informative, both reviews' required fixes landed (Plan 4, Task 4); registry 170 → 169.
