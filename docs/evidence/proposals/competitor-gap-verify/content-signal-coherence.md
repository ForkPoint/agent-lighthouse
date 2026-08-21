---
check: content-signal-coherence
title: "content-signal-coherence"
domain: competitor-gap-verify
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# content-signal-coherence

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Parses and reconciles Cloudflare's Content Signals Policy directives in robots.txt. Grammar: a `Content-Signal:` line inside a User-agent group, comma-delimited `name=value` pairs, names restricted to search | ai-input | ai-train, values restricted to yes | no, omission meaning no preference expressed. Four checks. (1) SYNTAX: unknown signal name, value other than yes/no, missing '=', duplicate signal within one group, or a Content-Signal line appearing before any User-agent line. (2) ACCESS/USE CONTRADICTION: a group declaring `ai-input=yes` or `search=yes` whose own rules Disallow '/' — the operator permits the use but blocks the fetch that would enable it, so the signal is dead text. Do NOT flag `ai-train=no` alongside `Allow: /`; that combination is the entire point of the policy. (3) SCOPE GAP, the highest-value finding: signals declared only in the `*` group while named AI-bot groups exist. By RFC 9309 §2.2.1 those bots never consult the wildcard group, so their content signals are simply undeclared — the operator believes they opted out of training and did not. (4) INFORMATIONAL: `search=no` is surfaced as a business-consequence note (it withdraws consent for search-index and excerpt use, which is how ChatGPT/Perplexity citations work) rather than a failure, because it may be deliberate.

## Claimed mechanism (falsifiable)

Cloudflare published the policy on 2025-09-24 and auto-injected `Content-Signal: search=yes, ai-train=no` into managed robots.txt across 3.8M+ domains, so a large population of sites now carries signals nobody on the site's team authored or audited. The policy governs USE after access while Allow/Disallow governs ACCESS, and the two are edited by different people at different times — which makes contradiction the default state, not the exception. Falsifiable: given robots.txt, the syntax is either conformant or not, and the intersection of {groups declaring a signal} with {groups a given AI token actually matches under RFC 9309} is either non-empty or not.

## Evidence

- **[Cloudflare — Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Launched 2025-09-24. robots.txt line 'Content-Signal: search=yes, ai-train=no' scoped to a User-Agent group. Three signals: search, ai-input, ai-train; values yes|no; omission = no preference expressed. Signals govern USE after access, orthogonal to Allow/Disallow which govern ACCESS. Auto-deployed to 3.8M+ domains via Cloudflare's managed robots.txt.
- **[contentsignals.org](https://contentsignals.org/)** — Cloudflare (spec, URL verified 2026-08-20)
  - Canonical policy home. Fetched successfully but served only a bare 'Content Signals' heading to the markdown extractor (JS-rendered); policy text was not retrievable, so treated as unverified and the Cloudflare blog post is used as the citable source.
- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the SAME token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Lighthouse core/config/agentic-browsing-config.js (main branch)](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/config/agentic-browsing-config.js)** — GoogleChrome/lighthouse (repo, URL verified 2026-08-20)
  - Complete shipped list of the Agentic Browsing category: exactly 6 auditRefs — agent-accessibility-tree, webmcp-form-coverage, webmcp-registered-tools, webmcp-schema-validity, cumulative-layout-shift, llms-txt. Two groups (webmcp, agent-accessibility). Category description says 'still under development and subject to change'. Copyright 2026 Google LLC.

## Competitor coverage

Nobody. Lighthouse does not read robots.txt beyond SEO is-crawlable and the pending ARD Agentmap line. Our repo has agent-governance.ts and tdm-rep.ts but grep confirms zero occurrences of 'content-signal'. No project in the GitHub census parses it. Cloudflare's own dashboard sets the header but does not audit coherence with the customer's hand-written rules.

## Implementation sketch

Pure robots.txt parse, zero extra requests, and it composes directly with ai-group-shadowing (check 3 is that audit's precedence rule applied to a different line type). Extend _robots-txt-helpers.ts to retain non-rule directive lines per group — the current parser almost certainly discards them. New file packages/core/src/audits/crawler-permissions/content-signals.ts. Grade B not A because the policy is a vendor-published convention with mass deployment, not an IETF standard, and no AI vendor has publicly committed to honouring it.

## Example failure

A publisher on Cloudflare has managed robots.txt on, giving them `User-agent: *` / `Content-Signal: search=yes, ai-train=no` / `Allow: /`. Their SEO team separately added `User-agent: GPTBot` / `Allow: /` to court ChatGPT traffic. Per RFC 9309, GPTBot now matches its own group and never reads the wildcard — so the ai-train=no signal does not apply to the one crawler that exists specifically to train models. The publisher believes they have opted out of training and has not. No tool on the market parses Content-Signal at all, let alone scopes it.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
