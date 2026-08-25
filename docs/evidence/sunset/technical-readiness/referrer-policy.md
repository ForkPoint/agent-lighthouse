---
audit: technical-readiness/referrer-policy
category: technical-readiness
audit_id: "8.5"
source_file: packages/core/src/audits/technical-readiness/referrer-policy.ts
slug: referrer-policy
review_verdict: delete
severity: medium
disposition: "sunset (approved 2026-08-21)"
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

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/technical-readiness/referrer-policy.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal. Without it, your site leaks full URL paths in referrer headers to third parties, which AI security audits flag as a privacy concern that can reduce trust scores.

### Code review findings (2026-08-20, 11-agent pass)

Presence-only check for a `referrer-policy` header, failing sites that lack it on the grounds that 'AI trust-scoring systems check for Referrer-Policy as a privacy maturity signal'. That is invented — no AI crawler or answer engine reads this header. The check is also largely moot on the modern web: since 2020-21 all major browsers default to `strict-origin-when-cross-origin`, which is precisely the value the audit's own `guidance.code` recommends. So a site with no header already behaves the way the audit asks, and is nonetheless scored 0.0. Nothing about passing this audit changes any AI agent outcome.

**Required fix:** Delete. If the maintainer wants to retain any security-header reporting, fold presence/value of Referrer-Policy into the single merged hygiene audit proposed for 8.2/8.3/8.4/8.6 as an informative line item with no score impact — and, if kept, at least reject `unsafe-url` and read `<meta name="referrer">`.

**False-positive risks:**
- Failing the browser-default behavior: absent header ⇒ browsers apply `strict-origin-when-cross-origin` ⇒ the audit's stated harm ('leaks full URL paths including query parameters') does not occur, yet the site scores 0.0.
- Presence-only: `if (value)` passes on `Referrer-Policy: unsafe-url`, the single most leaky value possible and the exact opposite of what the guidance asks for. Passing is not evidence of anything.
- `<meta name="referrer">` (the HTML delivery form, still common on CMS templates) is not read at all.
- Homepage-only; no-page guard produces a confident 'missing' fail on a scan that fetched nothing (its own test asserts this).

**Test gaps:**
- No test for `unsafe-url` (should not pass).
- No test for `<meta name="referrer" content="…">`.
- No test asserting the audit's premise against modern browser defaults.
- No WAF/challenge test.

**Overlaps with:** `8.2`, `8.3`, `8.4`, `8.6`, `8.7`

### Evidence

#### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/technical-readiness/referrer-policy.md`; that copy removed (one dossier per removed audit, under `sunset/`).
