---
audit: technical-readiness/correct-content-types
audit_id: "8.10"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/correct-content-types.ts
slug: correct-content-types
review_verdict: fix
severity: medium
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# correct-content-types (`8.10`)

> technical-readiness · source `correct-content-types.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents use Content-Type headers to determine how to parse your files. Incorrect MIME types cause JSON files to be treated as plain text (breaking schema parsing) or XML to be treated as HTML (breaking sitemap crawling). Fix Content-Type headers to match each file format.

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

**Mechanism:** CLAIM UNDER TEST: serving /llms.txt and .md mirrors as text/plain or text/markdown (rather than text/html, application/octet-stream or a wrong charset) is required for AI consumers to parse them correctly. FALSIFIABLE FORM: a named AI consumer that parses the file when served as text/plain fails to parse the byte-identical file served as application/octet-stream or text/html.

**Evidence:** Convention with sensible precedent, not a documented requirement. RFC 9116 does establish the pattern for well-known plain-text files — security.txt 'must be served as plain text (MIME type text/plain) with UTF-8 encoding'. The llms.txt spec uses type="text/markdown" when describing link relations, so text/markdown is the intent-consistent choice. Two real failure modes are mechanically certain rather than speculative: application/octet-stream triggers download-rather-than-parse behaviour in browser-based consumers, and a Content-Type of text/html on a Markdown file will lead HTML-oriented extraction pipelines to run an HTML parser over Markdown. X-Content-Type-Options: nosniff, where present, removes the browser's ability to recover from a wrong type.

**Counter-evidence:** The llmstxt.org specification states NO requirement for the file's own HTTP Content-Type — it only mentions text/markdown in the context of link relations. No AI vendor documentation (OpenAI, Anthropic, Perplexity, Google, Apple) specifies a Content-Type requirement for any AI-facing file. LLM ingestion pipelines are in practice tolerant text extractors; there is no published case of a named crawler rejecting a correctly-named llms.txt on Content-Type grounds. The widely repeated claim that 'some crawlers will refuse application/octet-stream' traces only to SEO blogs, not to any primary source. Grade C: plausible mechanism, partial adoption, unproven effect.
**Consumers:** browser-based agents (download vs parse behaviour), none-known among server-side crawlers · **Recommended tier:** informative

**Sources:** [The /llms.txt file](https://llmstxt.org/) · [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
