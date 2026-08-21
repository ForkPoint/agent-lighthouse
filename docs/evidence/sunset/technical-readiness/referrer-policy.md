---
audit: technical-readiness/referrer-policy
category: technical-readiness
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# referrer-policy — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: some AI crawler, answer engine, or agent platform inspects a site's HTTP response headers and derives a security/privacy posture score from them, and the presence of `Referrer-Policy` raises that score, making the site more likely to be crawled, trusted, or cited. A secondary steelman: the header materially changes what an AI browser agent (Atlas, Comet, Claude for Chrome) can see or do on the page, or affects whether AI-referral traffic is attributable.

## What we searched

WebSearch budget for the session was already exhausted, so all research was done by direct WebFetch against vendor docs, specs, and a working search endpoint (Brave HTML). Angles tried: (1) every first-party AI-crawler doc — OpenAI (developers.openai.com/api/docs/bots), Google (google-common-crawlers), Anthropic (support.claude.com ClaudeBot article), Perplexity (docs.perplexity.ai/guides/bots) — searching each for any mention of response headers read by the crawler; (2) Brave query `"referrer-policy" "AI crawler" OR "GPTBot" OR "ChatGPT" ranking trust score`; (3) Brave query for AEO/AI-readiness checklists naming security headers; (4) the empirical GEO literature — arXiv 2311.09735 (GEO: Generative Engine Optimization) full HTML, checking its 9 tested optimization methods; (5) AI-citation correlation studies (Semrush/Ahrefs-class) via Brave to see whether any tested technical/header-level factors; (6) the mechanical counter-angle — Chrome's default referrer policy. No source in any of these connected Referrer-Policy to AI crawling, agent behavior, or citation likelihood.

## Best evidence found for the audit

Nothing above trivial. The strongest thing found is generic security-hygiene endorsement of the header itself (Chrome's own blog calls it "a good idea to set an explicit, privacy-enhancing policy like strict-origin-when-cross-origin") — which is a human/browser-privacy rationale, not an AI one. Zero AI-side evidence: OpenAI's, Google's, Anthropic's and Perplexity's crawler documentation collectively mention only robots.txt directives, user-agent strings, Crawl-delay, and published IP ranges; none of the four mentions reading any HTTP response header for scoring or trust. The GEO paper's 9 tested levers are all content-level (quotation addition +41%, statistics +39%, cite sources +28%, fluency, readability, technical terms, unique words, authoritative tone, keyword stuffing) — no header, transport, or infrastructure lever was even in the experimental design. AI-citation correlation studies surface authority/referring-domains, expert quotes, URL slug length, and engagement; none tests security headers.

## Counter-evidence

Three positive disproofs, not merely absence of results. (1) Mechanical impossibility: `Referrer-Policy` governs the Referer header that the *client sends on requests originating from your pages*. It has no effect whatsoever on what a crawler or agent fetching your page can read, and it cannot affect AI-referral attribution either — whether a visit from ChatGPT shows up as chatgpt.com is decided by ChatGPT's own referrer policy, not yours. So even the audit's own steelman is directionally wrong. (2) Redundancy: Chrome has shipped `strict-origin-when-cross-origin` as the *default* since version 85 — https://developer.chrome.com/blog/referrer-policy-new-chrome-default states "Chrome plans to switch its default policy from no-referrer-when-downgrade to strict-origin-when-cross-origin, starting in version 85". Firefox and Safari made equivalent moves. The exact value the audit recommends is what every modern browser already does with no header, so the audit fails sites for a header that changes nothing in the common case. (3) The "AI trust-scoring systems" that the audit's `description`, `impact`, and failure `description` all assert as fact are unnamed and unfindable — no vendor names one, no study measures one. The claim as written in the audit copy is fabricated.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. No documented consumer exists on the AI side, and the stated mechanism is mechanically backwards — the header controls outbound referrers from the site's own pages and cannot influence how any crawler or agent reads the site. On top of that, the recommended value is already every major browser's default since Chrome 85, so a failing site is usually already getting the recommended behavior. The audit copy invents a category of system ("AI trust-scoring systems", "AI security audits") that no vendor or study corroborates. Delete. If the project wants a security-hygiene surface at all, it belongs in a clearly-labelled non-AI hygiene section alongside HSTS/CSP, not scored as AI readiness.

## Sources

- **[Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Documents OAI-SearchBot, OAI-AdsBot, GPTBot and ChatGPT-User. Control surface is exclusively robots.txt plus published IP-range JSON files. No mention of any HTTP response header, security header, Referrer-Policy, Permissions-Policy, security.txt, JS rendering, page speed, or preconnect.
- **[Google crawlers (user agents) overview](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)** — Google (vendor-doc, URL verified 2026-08-21)
  - Covers Google-Extended (Gemini training opt-out) and Google-CloudVertexBot. Focuses on user-agent identification, robots.txt rules and IP verification. Explicitly contains no mention of Referrer-Policy, Permissions-Policy or security.txt being read by crawlers.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - "Anthropic's Bots respect 'do not crawl' signals by honoring industry standard directives in robots.txt" plus non-standard Crawl-delay support and IP JSON lists. No HTTP response headers, no security headers, no security.txt, no page-speed or resource-hint guidance.
- **[PerplexityBot and Perplexity-User](https://docs.perplexity.ai/guides/bots)** — Perplexity (vendor-doc, URL verified 2026-08-21)
  - Documents PerplexityBot (search indexing, not model training) and Perplexity-User (user-triggered fetches that generally ignore robots.txt). Addresses only user-agent identification, IP whitelisting and WAF configuration — no response headers, security headers, security.txt, trust scoring, page speed or JS rendering.
- **[A new default Referrer-Policy for Chrome: strict-origin-when-cross-origin](https://developer.chrome.com/blog/referrer-policy-new-chrome-default)** — Google Chrome Developers (vendor-doc, URL verified 2026-08-21)
  - Chrome switched its default referrer policy to strict-origin-when-cross-origin as of version 85. Sites without the header already get exactly the value this audit recommends. "This is the new default, but websites can still pick a policy of their choice."
- **[GEO: Generative Engine Optimization](https://arxiv.org/html/2311.09735v3)** — arXiv (Aggarwal et al., KDD 2024) (study, URL verified 2026-08-21)
  - Nine tested optimization methods, all content-level: quotation addition (+41%), statistics addition (+39%), cite sources (+28%), fluency optimization, easy-to-understand, authoritative, unique words, technical terms, keyword stuffing. No HTTP header, security header, security.txt, page-speed or resource-hint lever was tested or discussed.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
