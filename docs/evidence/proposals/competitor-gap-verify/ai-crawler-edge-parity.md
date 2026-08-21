---
check: ai-crawler-edge-parity
title: "ai-crawler-edge-parity"
domain: competitor-gap-verify
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# ai-crawler-edge-parity

> Proposed check. Evidence grade **A** · unique · implementation: `multi-page`

## What it checks

Active differential fetching that reconciles what robots.txt PERMITS against what the CDN/WAF actually DOES. For the homepage plus up to 5 sitemap-selected URLs, issue paired GETs: a baseline with a current Chrome desktop UA, then one probe per AI product token using the exact documented UA strings (`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot`, `Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)`, `Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)`, `Mozilla/5.0 ... ChatGPT-User/1.0; +https://openai.com/bot`, `Mozilla/5.0 ... OAI-SearchBot/1.0; +https://openai.com/searchbot`). Identical headers otherwise, no cookies, max 5 redirects, 10s timeout, sequential with jitter to avoid self-inflicted rate limiting. Compare four signals per probe: HTTP status; final URL host and path; block fingerprints (`cf-mitigated` header, `server: cloudflare` + 403, `x-datadome`/`x-dd-b`, `challenges.cloudflare.com` or `hcaptcha.com` in body, Akamai reference-error page); and normalized main-content text length after stripping script/style/nav/footer. FAIL-critical when robots.txt Allows the URL for token T yet the probe returns 401/403/429/503 or a block fingerprint while baseline returns 200 — a declared-policy/enforced-policy contradiction. FAIL-high when both return 200 but probe_text_len / baseline_text_len < 0.6 (soft cloak / content downgrade). FAIL-high on cross-host redirect or redirect to a path matching /(block|denied|captcha|challenge|are-you-human)/i. WARN when a 429 arrives without a Retry-After header. PASS requires every probe to match baseline status with a length ratio >= 0.9.

## Claimed mechanism (falsifiable)

robots.txt is a declaration parsed by the bot; the CDN is the enforcement layer and does not read it. Cloudflare auto-enrolled millions of zones in AI bot blocking, so the two layers disagree routinely and silently. Causal claim: if the origin returns 403 to a request bearing the GPTBot UA while returning 200 to a browser UA, GPTBot receives no content, regardless of what robots.txt says — so the site can pass every existing llms.txt, schema and robots audit while being wholly invisible to ChatGPT. Falsifiable per URL per token: the paired responses either agree or they do not.

## Evidence

- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Anthropic — Does Anthropic crawl data from the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Three tokens with distinct purposes: ClaudeBot (training), Claude-User (live user-initiated fetch), Claude-SearchBot (search quality). IP list at https://claude.com/crawling/bots.json. Anthropic states IP-based blocking 'may not work correctly or persistently guarantee an opt-out' — robots.txt product tokens are the sanctioned control surface.
- **[Cloudflare — Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Launched 2025-09-24. robots.txt line 'Content-Signal: search=yes, ai-train=no' scoped to a User-Agent group. Three signals: search, ai-input, ai-train; values yes|no; omission = no preference expressed. Signals govern USE after access, orthogonal to Allow/Disallow which govern ACCESS. Auto-deployed to 3.8M+ domains via Cloudflare's managed robots.txt.
- **[The rise of the AI crawler (Vercel / Merj log study)](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-20)
  - None of GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Meta, ByteDance or Perplexity crawlers execute JavaScript; Gemini rides Googlebot infra (renders) and AppleBot renders. ChatGPT spends 11.50% of requests on JS files, Claude 23.84% — fetched as text, never executed. Crawl waste: ChatGPT 34.82% of fetches hit 404s and 14.36% follow redirects; Claude 34.16% hit 404s; Googlebot only 8.22%/1.49%.
- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the SAME token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.
- **[Profound — AI visibility platform](https://www.tryprofound.com/)** — Profound (vendor-doc, URL verified 2026-08-20)
  - Shipped features: Answer Engine Insights, Prompt Volumes, Agent Analytics (crawl frequency by bot, from the customer's own logs/edge), Shopping, Agents (content generation), Aim (task prioritisation). Zero active site-side audits: no robots.txt parsing, no llms.txt validation, no schema checks, no differential fetching.
- **[Conductor platform](https://www.conductor.com/)** — Conductor (vendor-doc, URL verified 2026-08-20)
  - Conductor Intelligence (visibility across ChatGPT/Gemini/Copilot/Claude), Conductor Creator, Conductor Monitoring ('24/7 monitoring tracks how AI bots crawl your site' — log/edge telemetry plus alerts), Conductor AgentStack. The only technical surface is passive bot-crawl monitoring; no documented llms.txt/schema/agent-protocol conformance audits.
- **[seoClarity Clarity ArcAI suite](https://www.seoclarity.net/)** — seoClarity (vendor-doc, URL verified 2026-08-20)
  - 12 named modules: Track Visibility, Research Prompts, Analyze Sentiment, Optimize Content, Measure Performance, Discover Bot Activity (/ai-seo/ai-bot-activity-tracking — 'know if AI bots access your pages', log-based), Monitor Accuracy, MCP Server and API, Accelerate Indexation, Monitor Web Mentions, Track AI Shopping, Product Feed Optimizer. Bot Activity is observational, not a conformance audit.
- **[GitHub repository census — llms.txt / MCP / agent-readiness auditing tools](https://github.com/search?q=llms.txt+validator&type=repositories)** — GitHub (queried via GitHub REST search API) (dataset, URL verified 2026-08-20)
  - Enumerated via gh api search/repositories. The field is generators, not auditors: AnswerDotAI/llms-txt (2575*, the spec itself), firecrawl/llmstxt-generator (537*), delucis/starlight-llms-txt (109*), thedaviddias/mcp-llms-txt-explorer (76*). Auditor-shaped projects are all <5 stars: hanselhansel/context-cli (robots+llms.txt+Schema.org+content density, 0-100), agentmarkup/agentmarkup (22*, build-time generation+validation), portdeveloper/llms-txt-check (1*, validates llms.txt against what the site actually serves), mikiships/agent-trust-scan (1*, A2A+MCP+llms.txt endpoint validation), abhi725/growth-mcp (1*), JerryZhi/AI-Crawler-Detector (5*, detects server-side AI crawler blocking beyond robots.txt), arturseo-geo/mcp-crawl-parity (1*, Googlebot vs AI crawler parity from Nginx logs). No project combines active differential fetching with robots.txt policy reconciliation.

## Competitor coverage

No commercial tool does active differential fetching. Lighthouse fetches only as Chrome. Conductor/seoClarity/Profound observe bots that already arrived, which cannot observe a bot that was blocked before reaching the log. Closest prior art is JerryZhi/AI-Crawler-Detector (5 stars, detects server-side blocking but does not reconcile against robots.txt) and arturseo-geo/mcp-crawl-parity (1 star, requires the operator's own Nginx logs).

## Implementation sketch

Extend packages/core/src/fetcher.ts, which today hardcodes a single SCANNER_USER_AGENT, to accept a UA override and return raw status + headers + body. New audit packages/core/src/audits/crawler-permissions/edge-parity.ts consuming a new orchestrator artifact. Fold the existing waf-detector.ts (currently single-UA, so it only detects a WAF blocking US) into the baseline leg. Cost is ~6 extra requests per sampled URL; cap total probes and run them after the main crawl. IMPORTANT honesty constraint: we spoof the UA without the matching source IP, and OpenAI/Anthropic publish IP files (openai.com/gptbot.json, claude.com/crawling/bots.json) that a rigorous edge may verify by forward-confirmed reverse DNS. So a 403 to our spoofed UA can mean 'this edge does IP verification' rather than 'this edge blocks GPTBot'. Mitigate by reporting the finding as UA-STRING-BASED BLOCKING, downgrading to warn when the block page or headers indicate verification, and never failing when the baseline UA is also blocked (that is a scanner problem, not a site problem).

## Example failure

A SaaS site publishes a hand-tuned robots.txt with `User-agent: OAI-SearchBot` / `Allow: /` because it wants ChatGPT search citations, and passes every AEO audit on the market. Its Cloudflare zone has the managed AI bot rule on, so every request carrying an OAI-SearchBot UA gets a 403 with `cf-mitigated: block`. The site is absent from ChatGPT search and no existing tool — Lighthouse, Profound, Otterly, Semrush, Conductor — will say why, because none of them ever sends a request as that bot.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
