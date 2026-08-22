---
audit: operability-safety/content-type-options
audit_id: "8.4"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/content-type-options.ts
slug: content-type-options
review_verdict: merge
severity: high
evidence_grade: C
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# content-type-options (`8.4`)

> operability-safety · source `content-type-options.ts` · review verdict **merge** · evidence grade **C** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI agents that fetch your JSON-LD, llms.txt, or API responses need correct MIME types to parse them. Without nosniff, browsers and agents may MIME-sniff responses incorrectly, causing JSON to be treated as HTML or plain text to be treated as a download.

## Code review findings (2026-08-20, 11-agent pass)

The stated mechanism is backwards and will actively mislead. The copy says 'Without nosniff, browsers and agents may MIME-sniff responses incorrectly, causing JSON to be treated as HTML' — but `X-Content-Type-Options: nosniff` makes clients STRICTER about honoring the declared Content-Type; its absence only permits sniffing, which in practice RESCUES misdeclared files rather than breaking them. What actually determines whether an agent parses your JSON-LD/llms.txt correctly is the Content-Type you send — which is exactly what audit 8.10 already measures. So 8.4 duplicates 8.10's purpose while getting the causality inverted, and it checks the header on the homepage HTML response, not on any of the JSON/txt files its own rationale is about.

**Required fix:** Merge into 8.10 (correct-content-types) as a secondary sub-signal checked on the actual AI/data files rather than on the homepage, and rewrite the rationale truthfully: 'nosniff hardens clients against MIME confusion; it does not fix an incorrect Content-Type — see the Content-Type audit for that.' Tighten the match to an exact token compare (`value.trim().toLowerCase() === 'nosniff'`). If the merge is rejected, at minimum delete the inverted causal claim from `description`, `guidance.impact` and the fail-branch `description`, and drop priority to low.

**False-positive risks:**
- Wrong target: the header is read from `ctx.pages[0].fetchResult.headers` (the homepage HTML). The files the rationale names — JSON-LD, llms.txt, API responses — are in `ctx.rootFiles` and are never inspected. A site with nosniff on HTML and no nosniff on /llms.txt passes.
- Inverted causality means the fix is not the fix: a user whose JSON-LD is genuinely misparsed will add nosniff (per this audit) and make the problem WORSE, because sniffing was the thing masking their bad Content-Type.
- Presence-only with a loose match: `value.toLowerCase().includes('nosniff')` passes on `X-Content-Type-Options: no-nosniff-here` or any string merely containing the substring.
- Homepage-only and no-page guard: empty `ctx.pages` reports a definite 'header is missing' fail.

**Test gaps:**
- No test on rootFiles headers, i.e. the files the audit claims to protect.
- No test for a value that merely contains the substring 'nosniff' as part of another token.
- No test pairing 8.4 with 8.10 to demonstrate the two do not contradict each other.
- No WAF/challenge test.

**Overlaps with:** `8.10`, `8.2`, `8.3`, `8.5`, `8.6`, `8.7`

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

**Mechanism:** CLAIM UNDER TEST: serving /llms.txt and .md mirrors as text/plain or text/markdown (rather than text/html, application/octet-stream or a wrong charset) is required for AI consumers to parse them correctly. FALSIFIABLE FORM: a named AI consumer that parses the file when served as text/plain fails to parse the byte-identical file served as application/octet-stream or text/html.

**Evidence:** Convention with sensible precedent, not a documented requirement. RFC 9116 does establish the pattern for well-known plain-text files — security.txt 'must be served as plain text (MIME type text/plain) with UTF-8 encoding'. The llms.txt spec uses type="text/markdown" when describing link relations, so text/markdown is the intent-consistent choice. Two real failure modes are mechanically certain rather than speculative: application/octet-stream triggers download-rather-than-parse behaviour in browser-based consumers, and a Content-Type of text/html on a Markdown file will lead HTML-oriented extraction pipelines to run an HTML parser over Markdown. X-Content-Type-Options: nosniff, where present, removes the browser's ability to recover from a wrong type.

**Counter-evidence:** The llmstxt.org specification states NO requirement for the file's own HTTP Content-Type — it only mentions text/markdown in the context of link relations. No AI vendor documentation (OpenAI, Anthropic, Perplexity, Google, Apple) specifies a Content-Type requirement for any AI-facing file. LLM ingestion pipelines are in practice tolerant text extractors; there is no published case of a named crawler rejecting a correctly-named llms.txt on Content-Type grounds. The widely repeated claim that 'some crawlers will refuse application/octet-stream' traces only to SEO blogs, not to any primary source. Grade C: plausible mechanism, partial adoption, unproven effect.
**Consumers:** browser-based agents (download vs parse behaviour), none-known among server-side crawlers · **Recommended tier:** informative

**Sources:** [The /llms.txt file](https://llmstxt.org/) · [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
