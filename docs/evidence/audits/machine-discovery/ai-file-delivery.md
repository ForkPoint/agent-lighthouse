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

How the AI files the scan already fetched are _delivered_ — two headers per file, one audit:

| File                           | Expected Content-Type                     |
| :----------------------------- | :---------------------------------------- |
| `/llms.txt`                    | `text/plain` or `text/markdown`           |
| `/.well-known/ai-catalog.json` | `application/json`                        |
| `/openapi.json`                | `application/json` (YAML types tolerated) |
| `/sitemap.xml`                 | `application/xml` or `text/xml`           |

A file counts as cacheable when it carries a `Cache-Control` with a non-zero `max-age` and no `no-store`/`no-cache`, **or** an `ETag` / `Last-Modified` validator.

| State                                                            | Result                    |
| :--------------------------------------------------------------- | :------------------------ |
| every served file correctly typed and cacheable                  | `pass`                    |
| any file mis-typed                                               | `fail`, priority `medium` |
| types correct, some file with no caching headers                 | `warn`, priority `low`    |
| no AI file was served (or the response is the site's HTML shell) | `na`                      |

At `tier: informative` / `weight 0` none of these outcomes moves a score.

## Evidence

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

**Mechanism:** The claim under test: serving /llms.txt and .md mirrors as text/plain or text/markdown (rather than text/html, application/octet-stream or a wrong charset) is required for AI consumers to parse them correctly. Falsifiable form: a named AI consumer that parses the file when served as text/plain fails to parse the byte-identical file served as application/octet-stream or text/html.

**Evidence:** Convention with sensible precedent, not a documented requirement. RFC 9116 does establish the pattern for well-known plain-text files — security.txt 'must be served as plain text (MIME type text/plain) with UTF-8 encoding'. The llms.txt spec uses type="text/markdown" when describing link relations, so text/markdown is the intent-consistent choice. Two real failure modes are mechanically certain rather than speculative: application/octet-stream triggers download-rather-than-parse behaviour in browser-based consumers, and a Content-Type of text/html on a Markdown file will lead HTML-oriented extraction pipelines to run an HTML parser over Markdown. X-Content-Type-Options: nosniff, where present, removes the browser's ability to recover from a wrong type.

**Counter-evidence:** The llmstxt.org specification states no requirement for the file's own HTTP Content-Type — it only mentions text/markdown in the context of link relations. No AI vendor documentation (OpenAI, Anthropic, Perplexity, Google, Apple) specifies a Content-Type requirement for any AI-facing file. LLM ingestion pipelines are in practice tolerant text extractors; there is no published case of a named crawler rejecting a correctly-named llms.txt on Content-Type grounds. The widely repeated claim that 'some crawlers will refuse application/octet-stream' traces only to SEO blogs, not to any primary source. Grade C: plausible mechanism, partial adoption, unproven effect.

## Implementation deviations

- **Absorbs `cache-headers` (8.11).** Its dossier is kept at
  [merged/machine-discovery/cache-headers.md](../../merged/machine-discovery/cache-headers.md).
- **Grade B comes from the caching half.** Google documents conditional
  requests first-party. The Content-Type half alone grades C.
- **The tier stays informative.** The caching benefit is to the site's
  bandwidth, not to a documented AI-agent outcome.
- **A mis-typed file served with `nosniff` is named as such** in the message.
  No audit checks `nosniff` on the homepage.
  `operability-safety/security-header-hygiene` dropped its header rows on
  2026-08-24 and now measures security.txt alone.

## Deferred

- Extend the path list to `/llms-full.txt`, `/agents.md`,
  `/sitemap-index.xml` and the feeds.
- Split the openapi entry so `.json` expects JSON and `.yaml` expects YAML.
- Accept gzipped-sitemap content types.
