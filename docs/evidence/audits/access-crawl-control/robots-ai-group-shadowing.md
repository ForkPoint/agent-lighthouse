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

Detects the RFC 9309 group-precedence trap: adding ANY named group for an AI product token silently voids every rule in the `User-agent: *` group for that bot. Parse robots.txt into groups; merge groups sharing a product token (§2.2.1) but never merge a named group with `*`. For each AI token that has an explicit group (GPTBot, OAI-SearchBot, ChatGPT-User, OAI-AdsBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, Bytespider, Amazonbot, meta-externalagent, meta-externalfetcher, Bravebot, DuckAssistBot, cohere-ai, MistralAI-User, Diffbot, AI2Bot, YouBot), build a probe path set P = every Allow/Disallow pattern literal appearing in ANY group, plus '/', plus up to 200 sitemap URLs. Evaluate each p in P twice — under the merged named group R_T and under the wildcard group R_star — using RFC 9309 longest-match-wins, Allow-wins-on-tie. Report three distinct failure classes. (a) SHADOWED-PROTECTION, high: p is Disallowed by R_star but Allowed by R_T — a path the operator meant to keep out of crawlers is open to this AI bot. (b) EMPTY-GROUP, critical: R_T contains zero Allow/Disallow rules (only Crawl-delay, Sitemap, or comments) — per §2.2.1 the bot matches this group, obeys its zero rules, and the wildcard is never consulted, so the entire site including every wildcard-disallowed path is open. (c) UNINTENDED-BLOCK, critical: R_star allows '/' but R_T disallows '/' — usually a copy-pasted block template that silently removed the site from that engine. Output a per-token table of divergent paths and the class.

## Claimed mechanism (falsifiable)

RFC 9309 §2.2.1 states the wildcard group is consulted only 'if no matching group exists'. Therefore, for any site with a named AI-bot group, the wildcard group's Disallow rules provably do not apply to that bot, and the operator's stated intent (expressed once in `*`) diverges from the enforced policy by exactly the symmetric difference of the two rule sets. Falsifiable by construction: given robots.txt R and token T, the set of paths where R_T and R_star disagree is computable and either empty or not.

## Evidence

- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the SAME token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Anthropic — Does Anthropic crawl data from the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Three tokens with distinct purposes: ClaudeBot (training), Claude-User (live user-initiated fetch), Claude-SearchBot (search quality). IP list at https://claude.com/crawling/bots.json. Anthropic states IP-based blocking 'may not work correctly or persistently guarantee an opt-out' — robots.txt product tokens are the sanctioned control surface.
- **[Lighthouse core/config/agentic-browsing-config.js (main branch)](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/config/agentic-browsing-config.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Complete shipped list of the Agentic Browsing category: exactly 6 auditRefs — agent-accessibility-tree, webmcp-form-coverage, webmcp-registered-tools, webmcp-schema-validity, cumulative-layout-shift, llms-txt. Two groups (webmcp, agent-accessibility). Category description says 'still under development and subject to change'. Copyright 2026 Google LLC.
- **[Lighthouse PR #17168 — new_audit(ard-schema): add Agent Resource Discovery gatherer and schema audit](https://github.com/GoogleChrome/lighthouse/pull/17168)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - OPEN PR (created 2026-08-10, branch agentic-resource-discovery). Adds core/audits/agentic/ard-schema.js + core/gather/gatherers/agentic/ard.js + vendored third-party/ard/ard.js ConformanceTester. Discovery precedence implemented: robots.txt 'Agentmap:' > <link rel="ai-catalog"> > Link: <...>; rel=ai-catalog HTTP header > /.well-known/ai-catalog.json fallback. Scores 1 / 0.5 (warnings) / 0 (errors); adds a Lighthouse-only warning for entries missing representativeQueries. This is the single biggest false-uniqueness risk for any ai-catalog.json check.
- **[GitHub repository census — llms.txt / MCP / agent-readiness auditing tools](https://github.com/search?q=llms.txt+validator&type=repositories)** — GitHub (queried via GitHub REST search API) (dataset, URL verified 2026-08-20)
  - Enumerated via gh api search/repositories. The field is generators, not auditors: AnswerDotAI/llms-txt (2575*, the spec itself), firecrawl/llmstxt-generator (537*), delucis/starlight-llms-txt (109*), thedaviddias/mcp-llms-txt-explorer (76*). Auditor-shaped projects are all <5 stars: hanselhansel/context-cli (robots+llms.txt+Schema.org+content density, 0-100), agentmarkup/agentmarkup (22*, build-time generation+validation), portdeveloper/llms-txt-check (1*, validates llms.txt against what the site actually serves), mikiships/agent-trust-scan (1*, A2A+MCP+llms.txt endpoint validation), abhi725/growth-mcp (1*), JerryZhi/AI-Crawler-Detector (5*, detects server-side AI crawler blocking beyond robots.txt), arturseo-geo/mcp-crawl-parity (1*, Googlebot vs AI crawler parity from Nginx logs). No project combines active differential fetching with robots.txt policy reconciliation.

## Competitor coverage

Nobody. Lighthouse's SEO category has is-crawlable (meta robots + X-Robots-Tag for the audited URL only) and reads robots.txt merely to look for the ARD Agentmap line in PR #17168. Semrush/Ahrefs robots testers answer 'is URL U allowed for bot B' one URL at a time and never diff a named group against the wildcard. No OSS project in the GitHub census evaluates group precedence divergence.

## Implementation sketch

Pure robots.txt parse, no extra network beyond the sitemap we already fetch. Reuse packages/core/src/audits/crawler-permissions/_robots-txt-helpers.ts — but note its current categoryBlocked() flattens rules across DIFFERENT bots' groups, which is a convenience for governance reporting and must not be reused here; this audit needs strict per-token group isolation. Add a longest-match evaluator: for path p, select the rule with the longest pattern matching p (with '*' and '$' expanded); on equal length, Allow wins. New file packages/core/src/audits/crawler-permissions/ai-group-shadowing.ts, category crawler-permissions.

## Example failure

A retailer's robots.txt reads `User-agent: *` / `Disallow: /checkout/` / `Disallow: /account/` / `Disallow: /admin/`, and further down someone added `User-agent: GPTBot` / `Crawl-delay: 10` to slow the crawler. Per RFC 9309, GPTBot now matches its own group, that group has no path rules, and the wildcard is never read — so GPTBot is fully permitted to crawl /checkout/, /account/ and /admin/. Every existing robots.txt checker reports this file as valid, and this tool's own per-bot audits report GPTBot as 'allowed', which is technically true and exactly the problem.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **`_robots-txt-helpers.ts` is deliberately not used.** Its `categoryBlocked()`
  flattens rules across different bots' groups — correct for governance
  reporting, wrong here. This audit calls `groupsForBot`, `hasNamedGroup` and
  `isPathAllowed` from `packages/core/src/gatherers/robots.ts`, which are
  strictly per-token and already implement longest-match-wins with
  Allow-winning-on-tie (RFC 9309 §2.2.2).
- **The wildcard baseline is evaluated by passing a token that appears in no
  group**, over a group list filtered to `*`. That reproduces "what the wildcard
  would have said" without duplicating the matcher.
- **Probe paths** are every `Allow`/`Disallow` literal in any group (with a
  trailing `$` stripped and the prefix before the first `*` added), plus `/`,
  plus the pathname of every scanned page, capped at 200. Sitemap URLs are not
  fetched for this audit; the scanned pages already stand in for real paths.
- **Three classes, two severities.** A reopened wildcard-protected path and an
  empty named group both fail: protection the operator wrote is not enforced.
  A named group that blocks a bot the wildcard allowed warns instead — it is
  frequently deliberate, and the finding says which reading applies.

## Deferred

- Group merging across several groups that share one product token relies on
  `groupsForBot` returning all of them; a token spelled two different ways
  (`GPTBot` and `gptbot/1.1`) merges, but a typo'd token does not and is
  reported as no named group.
