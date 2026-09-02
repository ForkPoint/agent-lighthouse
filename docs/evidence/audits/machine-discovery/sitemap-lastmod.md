---
audit: machine-discovery/sitemap-lastmod
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/sitemap-lastmod.ts
slug: sitemap-lastmod
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - "Applebot (Siri, Spotlight, Safari, Apple Intelligence grounding)"
  - Bingbot → Microsoft Copilot and Bing AI answers
  - Googlebot → AI Overviews / AI Mode / Gemini grounding
  - NLWeb ingestion tooling
signals:
  - name: sitemap.xml for AI crawler discovery
    grade: B
    domain: technical-infra
  - name: sitemap.xml — XML sitemap published and referenced from robots.txt
    grade: A
    domain: discovery-infra
sources:
  - sitemaps-protocol
  - google-crawl-budget-docs
  - google-ai-features-trust
  - vercel-rise-of-ai-crawler
  - s18
  - perplexity-crawlers-docs
  - apple-applebot-archived-2025
  - applebot-doc
  - bing-sitemaps-ai-search
  - google-sitemap-formats
  - anthropic-crawler-docs
  - nlweb-repo-howto
---

# sitemap-lastmod (`1.10`)

> content-discoverability · source `sitemap-lastmod.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI crawlers use <lastmod> to decide which pages to re-index and which to skip. Without these dates, crawlers must re-fetch every page on every visit.

## Code review findings (2026-08-20, 11-agent pass)

Requires >=80% of <url> entries to carry a <lastmod>. Same sitemap-index blindness as 1.9 (reports 'no <url> entries' on a valid index), and it only checks for the tag's presence — never its value — so it awards a full pass to the well-known antipattern of stamping every page with today's date, which crawlers explicitly learn to distrust. The audit therefore can reward the behaviour it claims to prevent.

**Required fix:** Resolve sitemap indexes via the shared resolver before counting. Parse each <lastmod> as a date and additionally flag (a) unparseable values, (b) future dates, and (c) the case where >90% of entries share one identical timestamp — that last case should warn, not pass. Scope the lookup to direct children (`$(el).children('lastmod')`). Return notApplicable when there are no <url> entries at all.

**False-positive risks:**

- `const urls = $('url')` → 0 on a `<sitemapindex>` → WARN 'Sitemap has no <url> entries' at high priority on a valid sitemap index. Sub-sitemap `<sitemap><lastmod>` values are ignored entirely.
- `if ($(el).find('lastmod').length > 0) withLastmod++` — presence only. A generator emitting `<lastmod>{build_time}</lastmod>` identically on all 5,000 URLs scores 100% and PASSES, which is precisely the signal-destroying pattern the guidance text warns about.
- No date format validation: `<lastmod>yesterday</lastmod>`, a malformed date, or a future date all count as present.
- `.find('lastmod')` is a descendant search, so a `lastmod` nested inside an extension element (e.g. `<image:image>`) inside a `<url>` counts as the URL's lastmod.
- 80% threshold is arbitrary; a site with 79% coverage FAILS at medium priority while 80% PASSES, with no gradation.
- 5MB truncation of a large sitemap changes the denominator unpredictably.

**Test gaps:**

- <sitemapindex> input (wrong verdict, untested)
- All lastmod values identical / equal to today — currently a false PASS
- Invalid or future date strings
- lastmod nested inside an extension element
- Truncated sitemap body

**Overlaps with:** `1.7`, `1.8`, `1.9`

## Evidence

### Signal: sitemap.xml for AI crawler discovery — grade B (technical-infra)

**Mechanism:** A valid sitemap.xml referenced from robots.txt, with absolute URLs and accurate <lastmod>, increases the set of URLs that AI-feeding crawlers discover and the speed at which changed pages are re-fetched. Falsifiable form: URLs present only in the sitemap (not reachable by internal links) are crawled by AI-feeding crawlers, and adding accurate lastmod shortens time-to-refetch after an edit.

**Grade: B** — Sitemaps are a stable, universally implemented de facto standard. Google documents consuming them directly: "Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl." That reaches AI Overviews and AI Mode through the same index. That is one documented consumer, not the AI vendors themselves: OpenAI's bots page, Anthropic's crawler article and Perplexity's documentation never mention sitemaps, and Google's own AI-features page insists there are "no additional technical requirements". Server logs showing GPTBot and ClaudeBot fetching `/sitemap.xml` are single-site reports. Well-established mechanism, weak AI-specific proof, is grade B.

**Evidence:** Sitemaps are a stable, universally-implemented de facto standard (protocol 0.9, 50k URLs / 50MB limits, robots.txt `Sitemap:` discovery). Google documents consuming them directly: 'Google reads your sitemap regularly, so be sure to include all the content that you want Google to crawl'. It also recommends <lastmod>. And Google's AI-features guidance makes AI Overviews and AI Mode eligibility conditional on ordinary Search indexing, so sitemap-driven discovery transitively feeds an AI surface. The same applies through Bing's index, which grounds Copilot. Vercel's crawl-waste data supplies an indirect argument. ChatGPT wastes 34.82% of fetches on 404s, and Claude 34.16%, against Googlebot's 8.22%. That is the signature of crawlers working from stale link graphs — precisely the failure a current sitemap with accurate lastmod mitigates.

**Counter-evidence:** No AI crawler vendor documents sitemap consumption. OpenAI's bots page, Anthropic's crawler article and Perplexity's docs never mention sitemaps, and Google's own AI-features page insists there are 'no additional technical requirements' for AI features. Server-log reports that GPTBot and ClaudeBot request /sitemap.xml exist but are single-site blog analyses, not controlled experiments — treat as suggestive only. The defensible framing is: sitemaps are proven for the Google/Bing indexes that ground several AI answer surfaces, and unproven-but-plausible for the direct AI crawlers. Note also that <lastmod> must be the page's real modification date, not the generation date, or the signal is actively misleading.

### Signal: sitemap.xml — XML sitemap published and referenced from robots.txt — grade A (discovery-infra)

**Mechanism:** Publishing a valid XML sitemap and declaring it via the robots.txt Sitemap: directive causes AI-serving crawlers to discover and re-crawl a larger, fresher set of URLs than link-graph traversal alone would reach; accurate <lastmod> raises recrawl priority. Falsifiable: if AI crawlers never fetch /sitemap.xml and coverage/freshness of AI-cited URLs is unchanged when a sitemap is added or removed, the claim fails.

**Grade: A** — Three independent vendor confirmations name the file. Apple's Applebot documentation stated verbatim that "Applebot accesses many kinds of resources from web servers, including but not limited to robots.txt, sitemaps, RSS feeds, HTML…". Bing documents sitemap consumption for the index behind Copilot. Google recommends the `Sitemap:` directive and `<lastmod>`. Named consumers stating they read the file is the grade-A bar. The counter-evidence is published with it rather than buried. OpenAI, Anthropic and Perplexity document no URL-discovery mechanism at all, and Apple's June 2026 revision quietly dropped the sentence. The A therefore covers crawlers backed by a search index, not pure-LLM fetchers.

**Evidence:** Three independent vendor confirmations. (1) Apple's own Applebot documentation stated verbatim that 'Applebot accesses many kinds of resources from web servers, including but not limited to robots.txt, sitemaps, RSS feeds, HTML…' — a direct, named-consumer statement for a crawler that feeds Siri and Apple Intelligence. (2) Bing's July 2025 webmaster post is explicitly framed around AI. Sitemap freshness signals 'directly influence how quickly updates are reflected in search results and AI generated answers'. lastmod 'remains a key signal, helping Bing prioritize URLs for recrawling and reindexing'. And accurate sitemap signals help 'AI-powered experiences like Copilot'. (3) Google's chain is transitive but airtight: AI Overviews/AI Mode eligibility requires that 'a page must be indexed and eligible to be shown in Google Search with a snippet', and Google supports the sitemaps protocol for discovering exactly those URLs. The sitemaps.org protocol further notes the robots.txt Sitemap: directive 'is independent of the user-agent line', so it is visible to every crawler that parses robots.txt — which includes GPTBot, ClaudeBot and PerplexityBot by their own documented robots.txt compliance.

**Counter-evidence:** Substantial and must be published alongside the claim. OpenAI's crawler documentation, Anthropic's crawler documentation, and Perplexity's crawler documentation contain zero mentions of sitemaps — none of the three pure-LLM vendors documents any URL-discovery mechanism at all. Apple's June 2026 revision of the Applebot page silently removed the sitemaps/RSS sentence, so the strongest quote is now only available as an archived snapshot. Google itself downgrades the guarantee: 'submitting a sitemap is merely a hint: it doesn't guarantee that Google will download the sitemap or use the sitemap for crawling URLs on the site'. It also treats sitemap inclusion as only 'a weak signal' for canonicalization. Empirically, the Vercel and MERJ data cuts against sitemap-driven crawling for LLM bots. ChatGPT spends 34.82% of fetches on 404s, and Claude 34.16%, against Googlebot's 8.22%. That is the signature of crawling from stale memory and hallucinated paths, not from a current sitemap. Claims circulating in SEO gray literature that GPTBot and ClaudeBot only began requesting sitemap.xml around March 2026 are unverified by any primary source and should not be cited.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
