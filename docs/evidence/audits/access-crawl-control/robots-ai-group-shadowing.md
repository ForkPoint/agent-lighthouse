---
audit: access-crawl-control/robots-ai-group-shadowing
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/robots-ai-group-shadowing.ts
slug: robots-ai-group-shadowing
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - rfc9309
  - s18
  - openai-searchbot-ips
  - anthropic-crawlers
  - anthropic-bots-json
  - lh-config
  - lh-ard-pr
  - oss-github
---

# robots-ai-group-shadowing

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Detects the RFC 9309 group-precedence trap: adding any named group for an AI product token silently voids every rule in the `User-agent: *` group for that bot. Parse robots.txt into groups; merge groups sharing a product token (§2.2.1) but never merge a named group with `*`. Twenty-three AI tokens can carry an explicit group: GPTBot, OAI-SearchBot, ChatGPT-User, OAI-AdsBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, Bytespider, Amazonbot, meta-externalagent, meta-externalfetcher, Bravebot, DuckAssistBot, cohere-ai, MistralAI-User, Diffbot, AI2Bot and YouBot. For each one that does, build a probe path set P: every Allow/Disallow pattern literal appearing in any group, plus '/', plus up to 200 sitemap URLs. Evaluate each p in P twice — under the merged named group R_T and under the wildcard group R_star — using RFC 9309 longest-match-wins, Allow-wins-on-tie. Report three distinct failure classes. (a) SHADOWED-PROTECTION, high: p is Disallowed by R_star but Allowed by R_T — a path the operator meant to keep out of crawlers is open to this AI bot. (b) EMPTY-GROUP, critical. R_T contains zero Allow or Disallow rules — only Crawl-delay, Sitemap, or comments. Per §2.2.1 the bot matches this group and obeys its zero rules. The wildcard is never consulted, so the entire site including every wildcard-disallowed path is open. (c) UNINTENDED-BLOCK, critical: R_star allows '/' but R_T disallows '/' — usually a copy-pasted block template that silently removed the site from that engine. Output a per-token table of divergent paths and the class.

## Claimed mechanism (falsifiable)

RFC 9309 §2.2.1 states the wildcard group is consulted only 'if no matching group exists'. For any site with a named AI-bot group, the wildcard group's Disallow rules therefore provably do not apply to that bot. The operator's stated intent, expressed once in `*`, diverges from the enforced policy by exactly the symmetric difference of the two rule sets. Falsifiable by construction: given robots.txt R and token T, the set of paths where R_T and R_star disagree is computable and either empty or not.

## Evidence

- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the same token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents, with separate robots.txt tokens and separate published IP-range files. OAI-SearchBot surfaces sites in ChatGPT search — https://openai.com/searchbot.json. OAI-AdsBot validates ad landing pages — https://openai.com/adsbot.json. GPTBot handles model training — https://openai.com/gptbot.json, ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Anthropic — Does Anthropic crawl data from the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Three tokens with distinct purposes: ClaudeBot (training), Claude-User (live user-initiated fetch), Claude-SearchBot (search quality). IP list at https://claude.com/crawling/bots.json. Anthropic states IP-based blocking 'may not work correctly or persistently guarantee an opt-out' — robots.txt product tokens are the sanctioned control surface.
- **[Lighthouse core/config/agentic-browsing-config.js (main branch)](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/config/agentic-browsing-config.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Complete shipped list of the Agentic Browsing category: exactly 6 auditRefs — agent-accessibility-tree, webmcp-form-coverage, webmcp-registered-tools, webmcp-schema-validity, cumulative-layout-shift, llms-txt. Two groups (webmcp, agent-accessibility). Category description says 'still under development and subject to change'. Copyright 2026 Google LLC.
- **[Lighthouse PR #17168 — new_audit(ard-schema): add Agent Resource Discovery gatherer and schema audit](https://github.com/GoogleChrome/lighthouse/pull/17168)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - OPEN PR (created 2026-08-10, branch agentic-resource-discovery). Adds core/audits/agentic/ard-schema.js + core/gather/gatherers/agentic/ard.js + vendored third-party/ard/ard.js ConformanceTester. Discovery precedence implemented: robots.txt 'Agentmap:' > <link rel="ai-catalog"> > Link: <...>; rel=ai-catalog HTTP header > /.well-known/ai-catalog.json fallback. Scores 1 / 0.5 (warnings) / 0 (errors); adds a Lighthouse-only warning for entries missing representativeQueries. This is the single biggest false-uniqueness risk for any ai-catalog.json check.
- **[GitHub repository census — llms.txt / MCP / agent-readiness auditing tools](https://github.com/search?q=llms.txt+validator&type=repositories)** — GitHub (queried via GitHub REST search API) (dataset, URL verified 2026-08-20)
  - Enumerated via gh api search/repositories. The field is generators, not auditors: AnswerDotAI/llms-txt (2575*, the spec itself), firecrawl/llmstxt-generator (537*), delucis/starlight-llms-txt (109*), thedaviddias/mcp-llms-txt-explorer (76*). Every auditor-shaped project has fewer than 5 stars.
  - hanselhansel/context-cli — robots, llms.txt, Schema.org and content density, scored 0-100.
  - agentmarkup/agentmarkup (22 stars) — build-time generation and validation.
  - portdeveloper/llms-txt-check (1 star) — validates llms.txt against what the site actually serves.
  - mikiships/agent-trust-scan (1 star) — A2A, MCP and llms.txt endpoint validation.
  - abhi725/growth-mcp (1 star).
  - JerryZhi/AI-Crawler-Detector (5 stars) — detects server-side AI crawler blocking beyond robots.txt.
  - arturseo-geo/mcp-crawl-parity (1 star) — Googlebot against AI crawler parity, from Nginx logs.
  - No project combines active differential fetching with robots.txt policy reconciliation.

## Example failure

A retailer's robots.txt reads `User-agent: *` / `Disallow: /checkout/` / `Disallow: /account/` / `Disallow: /admin/`, and further down someone added `User-agent: GPTBot` / `Crawl-delay: 10` to slow the crawler. Per RFC 9309, GPTBot now matches its own group, that group has no path rules, and the wildcard is never read — so GPTBot is fully permitted to crawl /checkout/, /account/ and /admin/. Every existing robots.txt checker reports this file as valid, and this tool's own per-bot audits report GPTBot as 'allowed', which is technically true and exactly the problem.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- `_robots-txt-helpers.ts` is not used. Its `categoryBlocked()` flattens rules across different bots' groups. The audit calls the strictly per-token `groupsForBot`, `hasNamedGroup` and `isPathAllowed` from `gatherers/robots.ts`.
- The wildcard baseline is evaluated by passing a token that appears in no group, over the groups filtered to `*`.
- Probe paths are every `Allow`/`Disallow` literal in any group (trailing `$` stripped, prefix before the first `*` added), plus `/`, plus the pathname of every scanned page, capped at 200. Sitemap URLs are not used.
- A reopened wildcard-protected path and an empty named group fail. A named group that blocks a bot the wildcard allowed warns, because it is often deliberate.
- `requires` omits `rendered-body` and `sample-adequate`. The verdict comes from robots.txt. Scanned pages only add probe paths.

## Deferred

- Group merging relies on `groupsForBot` returning every group for a token. A
  typo'd token does not merge and is reported as no named group.
