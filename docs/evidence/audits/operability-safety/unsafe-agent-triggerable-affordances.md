---
audit: operability-safety/unsafe-agent-triggerable-affordances
category: operability-safety
source_file: packages/core/src/audits/operability-safety/unsafe-agent-triggerable-affordances.ts
slug: unsafe-agent-triggerable-affordances
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - rfc9110-safe
  - anthropic-cu-tool
  - s18
  - openai-searchbot-ips
  - anthropic-claude-for-chrome
---

# Unsafe Agent-Triggerable Affordances

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Enumerate state-changing operations that a page exposes behind a plain GET — <a href> links and method="get" forms matching delete/cancel/logout/unsubscribe/add-to-cart/checkout patterns — and check whether any confirmation affordance stands between the link and the effect.

## Claimed mechanism (falsifiable)

RFC 9110 defines GET as read-only ('they do not commit to any action on the origin server') and notes that spiders are configured to follow links while crawling the web as a hypertext graph. Agents that explore a page rely on that contract. If consequence sits behind a bare GET, an exploring agent mutates account or cart state with no confirmation step and no CSRF token. So does an agent that has been prompt-injected elsewhere and instructed to click through. Anthropic's own guidance to require human confirmation for consequential actions then becomes unenforceable, because nothing in the markup signals consequence. Falsifier: if every state-changing operation is a POST behind a confirmation interstitial, no exploring agent can trip it.

## Evidence

- **[RFC 9110 §9.2.1 — Safe Methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods)** — IETF (spec, URL verified 2026-08-20)
  - 'Request methods are considered safe if their defined semantics are essentially read-only; they do not commit to any action on the origin server.' §3.5 notes spiders are configured to follow links while crawling the web as a hypertext graph. Ratified basis for the claim that an exploring agent may follow any GET link and expects no side effect.
- **[Computer use tool — security and prompt injection guidance](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - 'In some circumstances, Claude will follow commands found in content even when they conflict with your instructions. For example, instructions on webpages or contained in images might override your instructions.' Classifiers run on screenshots to flag injections and force user confirmation. Also recommends asking a human to confirm consequential actions — the vendor-side counterpart to the site-side 'don't hide consequence behind a GET link' check.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents, with separate robots.txt tokens and separate published IP-range files. OAI-SearchBot surfaces sites in ChatGPT search — https://openai.com/searchbot.json. OAI-AdsBot validates ad landing pages — https://openai.com/adsbot.json. GPTBot handles model training — https://openai.com/gptbot.json, ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Red-team attack success rate 23.6% in autonomous browsing mode, 11.2% after mitigations; a browser-specific challenge set went 35.7% -> 0%. Names the exact vectors: 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' This is the vendor-documented basis for auditing hidden inputs and a11y/metadata attributes.

## Example failure

A store renders 'Remove' in the cart as <a href="/cart?action=remove&item=482">. An agent asked to compare the cart against a wishlist explores the cart page, follows every link to read the resulting state, and empties the basket. The identical pattern at /account?action=delete is unrecoverable, and ChatGPT-User is documented as not necessarily honoring robots.txt on user-initiated fetches.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The audit never fetches a flagged URL. Fetching it would perform the action. A test pins that `ctx.fetch` is never called.
- Any one guard stops the finding: `rel="nofollow"`, `data-confirm`, `data-turbo-confirm`, `data-method`, an `onclick` calling `confirm(`, or a `method="post"` form.
- A path in a robots.txt `Disallow` rule is still reported, with the mitigation called partial. `Disallow: /` is ignored here: a site-wide block says nothing about one path.
- The empty-findings branch returns `notApplicable` when no page text was read. A JS shell exposes no links or forms, so silence is not safety.

## Deferred

- Verifying that a URL really mutates. That means fetching it, which this audit must not do.
- Buttons wired by script. A click handler carries no href to match. Detecting it needs the page to run.
