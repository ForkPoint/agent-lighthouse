---
audit: crawler-permissions/sensitive-paths
category: crawler-permissions
status: kept-rewrite
verdict: redeemable
evidence_grade: A
reviewed: 2026-08-21
---

# sensitive-paths — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **A**.

## Claimed mechanism (steelmanned)

AI crawlers obey path-level robots.txt Disallow rules, so adding Disallow for directories like /api/ and /admin/ keeps those URLs out of AI training corpora, AI search indexes and agent-generated answers. Steelmanned, this needs only one thing: a named AI crawler documented to honor per-path (not merely per-site) Disallow directives — the RFC 9309 path-matching semantics applied by a real AI product token.

## What we searched

WebSearch was exhausted after one call, so I fetched crawler documentation from five vendors directly plus the governing RFC. Angle 1 — the standard: fetched RFC 9309 for path-matching semantics and Security Considerations. Angle 2 — AI-training crawlers with explicit path examples: fetched Meta's web crawlers doc (meta-externalagent) and Apple's Applebot support article (119829, parsed from raw HTML because the summarizer truncated it). Angle 3 — the big two LLM vendors: fetched OpenAI's bots doc (developers.openai.com/api/docs/bots, after a redirect from platform.openai.com) and Anthropic's crawler support article. Angle 4 — the honesty check on user-triggered fetchers: fetched Perplexity's bots guide and re-read OpenAI's ChatGPT-User language. Angle 5 — Google's AI product tokens via the common-crawlers doc. The mechanism checks out; the audit's security framing does not.

## Best evidence found for the audit

Two AI vendors document path-level Disallow for their AI crawlers with literal directory examples. Apple, support article 119829: 'Applebot respects standard robots.txt directives in general search crawls that are targeted at Applebot. In this example, Applebot doesn't try to crawl documents that are under /private/ or /not-allowed/: User-agent: Applebot / Allow: / / Disallow: /private/' — and for the AI-training token specifically, 'You can add a rule in robots.txt to disallow Applebot-Extended, as follows: User-agent: Applebot-Extended / Disallow: /private/'. Meta, web crawlers doc: 'User-agent: meta-externalagent / Allow: / # Allow everything / Disallow: /private/ # Disallow a specific directory', for a crawler that 'crawls the web for use cases such as training foundation AI models'. Anthropic states 'Anthropic's Bots respect "do not crawl" signals by honoring industry standard directives in robots.txt' (ClaudeBot, Claude-User, Claude-SearchBot), and OpenAI directs publishers to use robots.txt for GPTBot and OAI-SearchBot opt-outs. RFC 9309 is a ratified standard whose path matching ('The most specific match found MUST be used') is what all of these implement. This is documented consumer behavior for the signal the audit inspects.

## Counter-evidence

The mechanism is real but the audit's stated BENEFIT — security/privacy, keeping internal endpoints out of training data — is contradicted by primary sources. 1) RFC 9309 states outright: 'The Robots Exclusion Protocol is not a substitute for valid content security measures', and warns that listing paths in robots.txt makes them publicly discoverable, directing operators to HTTP Authentication instead (https://www.rfc-editor.org/rfc/rfc9309.html). The audit's fix instruction therefore tells site owners to publish a map of their admin surface. 2) The agent traffic most likely to reach /admin/ or /api/ is user-initiated and exempt: OpenAI states of ChatGPT-User 'Because these actions are initiated by a user, robots.txt rules may not apply' (https://developers.openai.com/api/docs/bots), and Perplexity states its Perplexity-User fetcher 'generally ignores robots.txt rules' (https://docs.perplexity.ai/guides/bots). So the rule provides no protection against exactly the class of AI access the audit's threat model implies. 3) Anthropic's article demonstrates only root-level Disallow: / and never confirms path-granularity for its own bots. 4) Google's common-crawlers page introduces Google-Extended as a 'product token' without specifying path-level mechanics. 5) Domain-fit problem: this is an AI-agent-READINESS framework, and /api/ is precisely the surface agents want; a 'high' priority failure telling every site to Disallow: /api/ can degrade the outcome the tool exists to improve.

## Verdict

**redeemed — keep with rewrite** (grade A)

Grade A on the mechanism: named AI crawlers are documented to honor path-level Disallow, with literal directory examples from Apple (Applebot and the AI-training token Applebot-Extended, 'Disallow: /private/') and Meta (meta-externalagent, 'Disallow: /private/ # Disallow a specific directory'), on top of the ratified RFC 9309 path-matching semantics that OpenAI and Anthropic both point publishers to. Per the rubric that makes it redeemable — but it needs surgery, not preservation as written. Required changes: (a) drop the security/privacy framing entirely and cite RFC 9309's 'not a substitute for valid content security measures'; reframe as crawl hygiene — keeping low-value, non-canonical, or session-bearing URLs out of AI crawls and answers. (b) Remove /api/ from the default sensitive list or make it opt-in; blocking API paths works against agent readiness, and the audit currently fails sites at 'high' priority for exposing exactly what agents need. (c) Add the caveat that user-initiated fetchers (ChatGPT-User, Perplexity-User) are documented not to honor these rules, so this must never be presented as protection. (d) Downgrade defaultPriority from 'high' to low/medium — no vendor evidence supports a high-severity finding here.

## Sources

- **[RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-21)
  - Ratified standard defining path matching ('The most specific match found MUST be used'). Security Considerations state 'The Robots Exclusion Protocol is not a substitute for valid content security measures' and warn that listed paths become publicly discoverable.
- **[About Applebot](https://support.apple.com/en-us/119829)** — Apple (vendor-doc, URL verified 2026-08-21)
  - Explicit path-level examples: 'User-agent: Applebot / Allow: / / Disallow: /private/' and, for the generative-AI training token, 'User-agent: Applebot-Extended / Disallow: /private/'. Confirms AI-relevant crawlers honor per-directory rules.
- **[Meta web crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/)** — Meta (vendor-doc, URL verified 2026-08-21)
  - meta-externalagent 'crawls the web for use cases such as training foundation AI models'; documented robots.txt sample shows 'Allow: / # Allow everything' and 'Disallow: /private/ # Disallow a specific directory'. Notes robots.txt may be cached up to 24 hours.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - robots.txt is the documented control for GPTBot (training) and OAI-SearchBot (search opt-out). Critically: of ChatGPT-User, 'Because these actions are initiated by a user, robots.txt rules may not apply.'
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - 'Anthropic's Bots respect "do not crawl" signals by honoring industry standard directives in robots.txt' for ClaudeBot, Claude-User and Claude-SearchBot; examples shown are root-level Disallow: / only, with path granularity not explicitly confirmed.
- **[PerplexityBot and Perplexity-User](https://docs.perplexity.ai/guides/bots)** — Perplexity (vendor-doc, URL verified 2026-08-21)
  - Perplexity-User: 'Since a user requested the fetch, this fetcher generally ignores robots.txt rules.' Direct counter-evidence to robots.txt as a protection mechanism against agent access.
- **[Google crawlers and fetchers overview](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Google-Extended described as 'a standalone product token that web publishers can use to manage whether content Google crawls from their sites may be used for training future generations of Gemini models'; path-level enforcement mechanics are not spelled out on this page.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
