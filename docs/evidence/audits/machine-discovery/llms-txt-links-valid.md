---
audit: machine-discovery/llms-txt-links-valid
audit_id: "1.5"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-links-valid.ts
slug: llms-txt-links-valid
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# llms-txt-links-valid (`1.5`)

> content-discoverability · source `llms-txt-links-valid.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

Valid links in llms.txt ensure AI agents can navigate to your content without encountering dead ends.

## Code review findings (2026-08-20, 11-agent pass)

Fetches every llms.txt link and fails if any is not 200. Genuinely valuable signal (dead links in llms.txt do waste an agent's context), but it silently validates only absolute links, has no concurrency cap, and equates any non-200 with 'broken' — so WAF 403s, 429 rate limits and gated 401 pages are reported to the user as broken links they must fix.

**Required fix:** Resolve relative links against ctx.baseUrl rather than dropping them; use the same set for the denominator and the fetch list. Cap concurrency (e.g. 5) and prefer HEAD with GET fallback. Classify results: only 4xx/5xx excluding 401/403/429 count as broken; 401/403/429/0 report as 'unverifiable' and, when `ctx.wafProtection?.isBlocked`, return notApplicable instead of fail. Report the count of skipped/unsafe links explicitly.

**False-positive risks:**
- Relative links are dropped upstream by `extractMarkdownLinks()`, so a file of relative links produces WARN 'No links found in llms.txt to validate' — the audit reports it validated nothing while claiming coverage. Worse, `links.length` (pre-filter) is used as the denominator in the fail message while `resolved` (post-filter) is what actually got fetched, so 'N/M link(s) are broken' can print inconsistent counts.
- `await Promise.all(resolved.map((url) => ctx.fetch({ url })))` — unbounded parallel GETs against one origin. A 100-link llms.txt fires 100 simultaneous requests; the resulting 429s are reported as broken links.
- `broken = results.filter((r) => !isOk(r))` treats 401/403/429/503 and the fetcher's own `status: 0` timeout result as broken. On any Cloudflare/Akamai-protected site the audit lists the site's own pages as dead. `ctx.wafProtection` is available and ignored.
- `isSafeUrl()` does a live DNS lookup per link inside the loop, sequentially (`for … await`), adding seconds of latency and silently dropping links whose DNS is slow or fails transiently — those links are never reported as broken OR as skipped.
- Links to legitimately non-200 resources (a PDF behind 302 to a CDN that 403s the scanner UA, an intentionally 410'd page) are indistinguishable from mistakes.

**Test gaps:**
- Relative links in llms.txt (never fetched, silently 'no links')
- 403/429/503 responses vs genuine 404
- Timeout/status:0 results from the fetcher
- A link list large enough to trigger the unbounded-parallelism problem
- Redirecting links (301 → 200) — should pass but is untested
- Mismatch between `links.length` and the actually-fetched `resolved.length` in the fail message

**Overlaps with:** `1.4`, `1.20`

## Evidence

### Signal: /llms.txt existence at domain root (llmstxt.org proposal) — grade C (llms-txt)

**Mechanism:** Publishing a well-formed /llms.txt at the domain root causes major AI crawlers and agents (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended) to fetch it and use it to navigate the site, measurably increasing retrieval coverage or citation rate. FALSIFIABLE TEST: AI-crawler request rate to /llms.txt in server logs, and matched-pair citation-rate lift.

**Evidence:** REFUTED on the retrieval mechanism; SUPPORTED only as a compliance/convention signal. The spec is real and actively maintained (llmstxt.org v2, 2026-08-10, ~2.6k GitHub stars) and adoption is non-trivial: 8.7% of Tranco top-1,000 (15.8% of the 549 reachable), ~10.13% across a 300k-domain SE Ranking sample, and all four major AI labs publish one (I verified HTTP 200 on Anthropic, OpenAI, Perplexity, Cloudflare, Stripe, GitHub, Vercel). Google Chrome ships a real llms-txt audit in Lighthouse 13.3's Agentic Browsing category — I read the audit and gatherer source directly. BUT no vendor anywhere documents an agent consuming it, and four independent log studies converge on near-zero AI-crawler interest: Otterly 84/62,100 requests over 90 days (0.1%); Evil Martians ~770 fetches of which only 37 came from named AI assistants across 268k agent requests; Dries Buytaert 52 requests in a month, 'every one came from SEO audit tools'; Wislr 48 days/19 bots, 'zero hits from GPTBot, ClaudeBot, PerplexityBot, or any other AI crawler.' MaxAEO's 2,400-domain matched-pair study found citation rates of 11.8% (with) vs 11.6% (without) — +0.2pp, inside the noise band.

**Counter-evidence:** Google Search Central explicitly names the file: 'LLMS.txt files and other special markup: You don't need to create new machine readable files... Doing so will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them.' John Mueller: 'it's purely speculative for now (the file has existed for years, yet none of the AI systems use it).' Gary Illyes: Google does not support it and has no plans to. Perplexity's crawler doc names only robots.txt. OpenAI's crawler doc never mentions it. No W3C or IETF standing — I searched w3.org and found only unrelated AI groups; the widely-repeated 'June 2026 W3C proposal to standardize llms.txt' appears to be SEO blogspam with no primary source. Crucially, Lighthouse itself returns notApplicable (score 1) on HTTP 404 — even Google does not penalize absence. Beware the vendor-incentive trap: the main pro-adoption data comes from Mintlify and Profound, who sell llms.txt tooling, with no published methodology.
**Consumers:** Google Lighthouse 13.3+ agentic-browsing audit (an auditor, not an agent), Dataprovider.com and SEO audit tools (observed in logs), none-known among answer engines or LLM crawlers · **Recommended tier:** informative

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [AnswerDotAI/llms-txt repository](https://github.com/AnswerDotAI/llms-txt) · [Lighthouse core/audits/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [llms.txt | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) · [AI features and your website — AI optimization guide (mythbusting section)](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Google Confirms LLMs.txt Has No Current Implementation / 'purely speculative for now'](https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/577576/) · [Google says llms.txt files won't harm or help your search rankings](https://searchengineland.com/google-says-llms-txt-files-wont-harm-or-help-your-search-rankings-480264) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [LLMS.txt Adoption Tracker (Tranco top 1,000)](https://www.rankability.com/data/llms-txt-adoption/) · [llms.txt and AI Visibility: Results from OtterlyAI's GEO Study](https://otterly.ai/blog/the-llms-txt-experiment/) · [Which AI actually reads your site? Two months of LLM traffic, measured](https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured) · [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers) · [AI Bot Traffic Is Accelerating Fast. 48 Days of Server Logs Expose What GPTBot, ChatGPT, ClaudeBot, and 16 Others Are Doing](https://www.wislr.com/articles/ai-bot-behavior-log-analysis/) · [Does llms.txt Work? Evidence From AI Citation Data](https://maxaeo.ai/blog/does-llms-txt-work/) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

### Signal: llms.txt content quality conventions (H1, blockquote summary, sectioned links with descriptions, link validity) — grade B (llms-txt)

**Mechanism:** An llms.txt that conforms to structural conventions is machine-parseable and passes automated validation, whereas a malformed one fails. Split precisely: (a) H1 present, (b) at least one [text](url) markdown link, (c) length >= 50 chars are enforced by a real shipping consumer; (d) blockquote summary, (e) per-link descriptions, (f) link validity are spec-optional with NO known enforcing consumer. FALSIFIABLE TEST: run the exact Lighthouse regexes against the file.

**Evidence:** This is the best-evidenced llms.txt signal because it has an exact, documented, shipping consumer whose rules I read in source rather than inferring. Lighthouse core/audits/agentic/llms-txt.js (Copyright 2026 Google LLC) applies precisely: hasH1 = /^\s*#\s+.+/m, hasLink = /\[.+\]\(.+\)/, isTooShort = content.length < 50, scoring 1 only if all three pass, with failure strings 'File is missing a required H1 header', 'File does not appear to contain any links', 'File is suspiciously short'. This is verifiable and reproducible, independently corroborated by DebugBear and by an SEJ case where a file with working bare URLs failed until links were wrapped in markdown syntax. The spec backs (a): the H1 is 'the only required section'. Auditing conformance is therefore defensible even though the underlying file's value to agents is not — this signal grades the parseability claim, which is true, not the retrieval claim, which is refuted.

**Counter-evidence:** Sharply scope this signal. The blockquote convention is optional in the spec, unchecked by Lighthouse, and not universally followed even by exemplars: in my measurement of 7 major vendor files, 7/7 had an H1 and markdown links but only 5/7 had a blockquote — Anthropic and Stripe both omit it, so failing sites for a missing blockquote would fail Anthropic's own file. Lighthouse checks NO link validity, NO per-link descriptions, and NO section structure. SEJ's caveat is the honest frame: 'The audit checks whether your file is mechanically parseable. It does not check whether the file describes your website usefully.' And parseability is worth little when the consumer population is near-empty — Lighthouse is an auditor, not an agent, and it scores a 404 as notApplicable. Link-validity checking is also expensive at scale (Vercel's file has 1,872 links).
**Consumers:** Google Lighthouse 13.3+ (llms-txt audit: H1, markdown-link, 50-char checks), DebugBear agentic-browsing suite, none-known for blockquote, descriptions, or link validity · **Recommended tier:** scored

**Sources:** [Lighthouse core/audits/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [llms.txt | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [Lighthouse: llms.txt does not follow recommendations](https://www.debugbear.com/docs/agentic-browsing/llms-txt-does-not-follow-recommendations) · [Lighthouse Fails Your llms.txt Without Markdown Links](https://www.searchenginejournal.com/lighthouse-fails-your-llms-txt-without-markdown-links/577590/) · [The /llms.txt file, v2](https://llmstxt.org/) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
