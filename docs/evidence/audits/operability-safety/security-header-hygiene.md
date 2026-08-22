---
audit: operability-safety/security-header-hygiene
audit_id: "8.2, 8.3, 8.4, 8.7"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/security-header-hygiene.ts
slug: security-header-hygiene
review_verdict: consolidate
severity: low
evidence_grade: B
disposition: "consolidated 2026-08-22 (Plan 4, Task 3) — informative, weight 0"
reviewed: 2026-08-22
---

# security-header-hygiene (`8.2`, `8.3`, `8.4`, `8.7`)

> operability-safety · source `security-header-hygiene.ts` · consolidates hsts-header (8.2), csp-header (8.3), content-type-options (8.4), security-txt (8.7) · evidence grade **B** · tier **informative** (weight 0)

## Mechanism claim

**Falsifiable claim:** *none is made about AI agents.* The four signals this audit reports — `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff` and `/.well-known/security.txt` — are browser- and human-facing security mechanisms. The evidence review found no AI crawler, retrieval pipeline or answer engine documented to read any of them, so the audit makes no claim that adding them changes AI-agent behaviour. It reports their state as hygiene, at weight 0, and never fails the site.

The one adjacent claim that *is* falsifiable and supported belongs to transport security rather than to the header: agent protocols mandate HTTPS outright (MCP 2025-11-25 requires HTTPS for every authorization endpoint and redirect URI; RFC 9116 requires security.txt to be served over HTTPS), and browser-resident agents inherit Chromium's mixed-content and HTTPS-First behaviour. That is the strongest evidence among the four sources and it is what sets this audit's grade — see [Grade](#grade).

## What it checks

One homepage response and one root file, four rows:

| Signal | `ok` | `weak` | `missing` |
| :--- | :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age >= 31536000` | `max-age=0` (HSTS disabled), `max-age` below one year, or no `max-age` directive | header absent |
| `Content-Security-Policy` | enforced policy via response header **or** `<meta http-equiv>` | report-only policy, or a permissive policy (`'unsafe-inline'`, `'unsafe-eval'`, `default-src *`) | neither header nor meta tag |
| `X-Content-Type-Options` | value is exactly `nosniff` (trimmed, case-insensitive) | present with any other value | header absent |
| `security.txt` | 200 with a `Contact` field and an `Expires` date in the future | HTML soft-404 at 200, missing `Contact`, missing/unparseable `Expires`, or expired | non-200, or never fetched |

Result semantics: `pass` when all four rows are `ok`, `warn` otherwise, `na` when no page response was captured at all. **`fail` is never returned**, and `scoreDisplayMode: 'informative'` with `weight: 0` keeps every outcome out of the category score, the readiness vitals and the top-fails list.

## Why the four were consolidated

The approved v2 map row for 8.2 rules the consolidated signal "weight 0, never fails a site" (`docs/evidence/v2-audit-map.md`, §5 consolidation, audits 8.2–8.7). The four v1 audits levied four independent penalties for one unproven mechanism:

- **8.2 hsts-header** — presence-only, priority `high`, motivated by a fabricated claim that AI crawlers waste a redirect hop and that enterprise RAG pipelines reject non-HSTS sites. HSTS is browser-enforced state; GPTBot and ClaudeBot maintain none.
- **8.3 csp-header** — presence-only, priority `high`, motivated by "AI trust-scoring systems check for CSP headers". No such system is documented. Its own detection failed static hosts that ship CSP as a meta tag and passed `default-src *`.
- **8.4 content-type-options** — stated its mechanism backwards: `nosniff` makes clients *stricter* about the declared `Content-Type`, so its absence rescues a misdeclared file rather than breaking it. What actually determines whether an agent parses `llms.txt` or JSON-LD is the `Content-Type` itself, which `machine-discovery/ai-file-delivery` (v1 8.10) measures.
- **8.7 security-txt** — status-only, motivated by an AI trust score that does not exist. RFC 9116 is Informational and its documented consumers are security researchers and vulnerability-notification tooling.

Consolidating also let each source audit's code-review fixes land in one place rather than four: `max-age` parsing, meta/report-only CSP delivery, an exact `nosniff` token compare, a parsed security.txt (Contact + unexpired Expires, legacy `/security.txt` fallback, SPA soft-404 guard), and an `na` result when no page response was captured instead of v1's confident "header is missing" failure.

## Grade

**B — the strongest proven consumer path among the four sources, not the average.**

The security-headers signal shared by 8.2/8.3/8.4 grades **D** with `Consumers: none-known` and `Recommended tier: delete`. security.txt (8.7) grades **C** — real RFC, real but small adoption (~1.25% of the top 1M in 2025), zero AI consumers. The HTTPS/transport-security signal behind HSTS grades **B**: MCP, RFC 9116 and Chromium-based agent surfaces all mandate TLS, which is a documented, testable requirement even though no crawler vendor documents HSTS itself.

Grade B therefore prices the evidence, and `tier: informative` prices the *claim*: `weightForGrade('B', 'informative') === 0`. The grade records what the evidence supports; the tier records that nothing here may move a score. A future task that finds a documented AI consumer for any of these headers can promote the tier without re-grading the evidence.

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies run in the OPPOSITE direction from the v1 audits: (1) CSP `frame-ancestors` / `X-Frame-Options` can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe, which is a property of the app, not of the publisher's site; (3) `X-Content-Type-Options: nosniff` only matters in a browser and only makes a wrong `Content-Type` more fatal — it belongs to the content-type signal, not here.
**Consumers:** none-known · **Recommended tier:** delete → reported as informative

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site: agent-protocol specs mandate HTTPS outright, well-known agent/security files are defined as HTTPS-only, and browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour.

**Evidence:** MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS' and 'All redirect URIs MUST be either localhost or use HTTPS'. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and inherit mixed-content blocking, so an HTTP-only page degrades for the fastest-growing agent class.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement, and HSTS specifically has no documented AI consumer at all — the header is a browser-state mechanism layered on top of the TLS the agents actually need. This is why the B grade lives on the transport signal while the audit that reports the header stays informative. The scored HTTPS check itself is `access-crawl-control/https-enabled` (v1 8.1), which this audit does not duplicate.
**Consumers:** MCP clients (Claude, ChatGPT, VS Code, Cursor), ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome, security.txt tooling · **Recommended tier:** scored (for HTTPS itself, not for HSTS)

**Sources:** [Model Context Protocol Specification (2025-11-25) — Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) · [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

### Signal: security.txt (/.well-known/security.txt) — grade C (technical-infra)

**Mechanism:** CLAIM UNDER TEST: AI agents read /.well-known/security.txt to identify the site operator or a disclosure contact, and its presence improves how agents treat the site.

**Evidence:** security.txt is a real, published IETF document (RFC 9116) with a well-defined location, media type (text/plain, UTF-8, HTTPS-only) and required fields (Contact, Expires), and it has genuine — if small — adoption: roughly 0.7% of the top 1M domains in April 2024 rising to about 1.25% in 2025, with a broader count of ~573,000 domains by 2026.

**Counter-evidence:** RFC 9116 is INFORMATIONAL, explicitly 'not an Internet Standards Track specification'. Its stated consumers are human security researchers and vulnerability-notification tooling; no AI vendor documentation mentions security.txt at all. Conformity is poor — analyses find only a minority of deployed files pass RFC validation, so presence alone is weak evidence of anything. Hence the parse-not-probe detection in this audit, and the informative tier.
**Consumers:** security researchers, vulnerability-disclosure scanners, none-known among AI agents · **Recommended tier:** informative

**Sources:** [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [security.txt Revisited: Analysis of Prevalence and Conformity in 2022](https://seclab.cs.hm.edu/assets/pdf/th-sectxt-2023.pdf)

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

Carried here only to record where the `nosniff` sub-signal belongs. `X-Content-Type-Options: nosniff` removes a browser's ability to recover from a wrong `Content-Type`; what an agent actually needs is the correct type, which `machine-discovery/ai-file-delivery` (v1 8.10) measures on the AI files themselves. This audit reports `nosniff` on the homepage response as hygiene and makes no parsing claim.

**Sources:** [The /llms.txt file](https://llmstxt.org/) · [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html)

## Source dossiers

The four absorbed dossiers are kept verbatim as the record of why each signal moved:

- [hsts-header (8.2)](../../merged/operability-safety/hsts-header.md) — grade B
- [csp-header (8.3)](../../merged/operability-safety/csp-header.md) — grade D
- [content-type-options (8.4)](../../merged/operability-safety/content-type-options.md) — grade C
- [security-txt (8.7)](../../merged/operability-safety/security-txt.md) — grade C

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on the four source audits.
- 2026-08-21 — dispositions approved: 8.2/8.4 merge, 8.7 informative weight 0, 8.3 fix-then-fold.
- 2026-08-22 — consolidated into this audit (Plan 4, Task 3); registry 177 → 174.
