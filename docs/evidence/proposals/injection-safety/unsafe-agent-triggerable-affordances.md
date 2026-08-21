---
check: unsafe-agent-triggerable-affordances
title: "Unsafe Agent-Triggerable Affordances"
domain: injection-safety
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Unsafe Agent-Triggerable Affordances

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Enumerate state-changing operations that a page exposes behind a plain GET — <a href> links and method="get" forms matching delete/cancel/logout/unsubscribe/add-to-cart/checkout patterns — and check whether any confirmation affordance stands between the link and the effect.

## Claimed mechanism (falsifiable)

RFC 9110 defines GET as read-only ('they do not commit to any action on the origin server') and notes that spiders are configured to follow links while crawling the web as a hypertext graph. Agents that explore a page rely on that contract. If consequence sits behind a bare GET, an exploring agent — or an agent that has been prompt-injected elsewhere and instructed to click through — mutates account or cart state with no confirmation step and no CSRF token, and Anthropic's own guidance to require human confirmation for consequential actions becomes unenforceable because nothing in the markup signals consequence. Falsifier: if every state-changing operation is a POST behind a confirmation interstitial, no exploring agent can trip it.

## Evidence

- **[RFC 9110 §9.2.1 — Safe Methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods)** — IETF (spec, URL verified 2026-08-20)
  - 'Request methods are considered safe if their defined semantics are essentially read-only; they do not commit to any action on the origin server.' §3.5 notes spiders are configured to follow links while crawling the web as a hypertext graph. Ratified basis for the claim that an exploring agent may follow any GET link and expects no side effect.
- **[Computer use tool — security and prompt injection guidance](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - 'In some circumstances, Claude will follow commands found in content even when they conflict with your instructions. For example, instructions on webpages or contained in images might override your instructions.' Classifiers run on screenshots to flag injections and force user confirmation. Also recommends asking a human to confirm consequential actions — the vendor-side counterpart to the site-side 'don't hide consequence behind a GET link' check.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Red-team attack success rate 23.6% in autonomous browsing mode, 11.2% after mitigations; a browser-specific challenge set went 35.7% -> 0%. Names the exact vectors: 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' This is the vendor-documented basis for auditing hidden inputs and a11y/metadata attributes.

## Competitor coverage

Nobody ships this. SEO crawlers deliberately avoid such URLs (or the site excludes them in robots.txt) and report them at most as crawl-budget waste; Lighthouse's agentic category measures whether an agent can operate the page, never whether operating it is destructive. This is the old 'Google Web Accelerator deleted my records' failure mode, resurfaced by agents and unaudited by any current tool.

## Implementation sketch

Never follow a flagged link — this check is purely markup analysis. Enumerate every <a href> and every <form method="get"> action URL on the sampled pages. Match against state-verb patterns: /([?&])(action|do|cmd|op|task)=(delete|remove|destroy|cancel|purge|reset|clear|unsubscribe|optout|revoke)/i, /add[-_]?to[-_]?cart/i, /\/(logout|signout|sign-out|unsubscribe|delete-account|checkout|confirm-order)(\/|$|\?)/i, /([?&])(confirm|approve|accept|apply)=(1|true|yes)/i. For each match, look for a confirmation affordance on the element or an ancestor: data-confirm/data-turbo-confirm attributes, an onclick containing confirm(, membership in a <form method="post">, or rel containing nofollow. FAIL on a state-verb GET link with none of those. WARN on <form method="get"> whose action matches a state verb (query-string mutation, trivially replayable). Separately report whether the site declares any of these paths in robots.txt Disallow — a partial mitigation for well-behaved crawlers but not for ChatGPT-User, which OpenAI documents as not necessarily bound by robots.txt for user-initiated fetches, nor for a computer-use agent driving a real browser. Present findings as 'agent tripwires' with the fix: POST plus a confirmation step, or rel="nofollow" as a minimum.

## Example failure

A store renders 'Remove' in the cart as <a href="/cart?action=remove&item=482">. An agent asked to compare the cart against a wishlist explores the cart page, follows every link to read the resulting state, and empties the basket. The identical pattern at /account?action=delete is unrecoverable, and ChatGPT-User is documented as not necessarily honoring robots.txt on user-initiated fetches.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
