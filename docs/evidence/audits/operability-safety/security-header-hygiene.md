---
audit: operability-safety/security-header-hygiene
category: operability-safety
source_file: packages/core/src/audits/operability-safety/security-header-hygiene.ts
slug: security-header-hygiene
evidence_grade: C
disposition: "narrowed 2026-08-24 (contradiction sweep, Part 2 Task 11) — security.txt only, informative, weight 0"
reviewed: 2026-08-24
recommended_tier: informative
consumers:
  - security researchers
  - vulnerability-disclosure scanners
  - none-known among AI agents
signals:
  - name: "Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals"
    grade: D
    domain: technical-infra
  - name: "HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect)"
    grade: B
    domain: technical-infra
  - name: security.txt (/.well-known/security.txt)
    grade: C
    domain: technical-infra
  - name: Correct Content-Type for llms.txt and .md files
    grade: C
    domain: technical-infra
sources:
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
  - google-ai-features-trust
  - s21
  - openai-apps-sdk-security
  - mcp-spec-authorization
  - rfc9116
  - security-txt-prevalence-study
  - llmstxt-spec-link
---

# security-header-hygiene (`8.7`)

> operability-safety · source `security-header-hygiene.ts` · v1 8.7 (security-txt) · evidence grade **C** · tier **informative** (weight 0)

Narrowed on 2026-08-24 to the security.txt signal alone. The three security-header rows this audit used to report — `Strict-Transport-Security` (8.2), `Content-Security-Policy` (8.3) and `X-Content-Type-Options` (8.4) — were removed as not-a-factor; see Implementation deviations below. The check id is unchanged for now, so the audit is still registered as `operability-safety/security-header-hygiene` even though it now measures one file and no headers; renaming it is a separate, central change.

## Claimed mechanism (falsifiable)

**Falsifiable claim:** _none is made about AI agents._ `/.well-known/security.txt` is a vulnerability-disclosure file whose stated consumers are human security researchers and vulnerability-notification tooling. The evidence review found no AI crawler, retrieval pipeline or answer engine documented to read it, so the audit makes no claim that publishing one changes AI-agent behaviour. It reports the file's RFC 9116 conformance at weight 0, and never fails the site.

What the audit does claim, and what is testable, is narrower. RFC 9116 defines what a security.txt must contain. A _published_ file with no `Contact`, no `Expires`, an unparseable `Expires`, or an `Expires` in the past does not conform — and it advertises a disclosure route that no longer works. That claim is about the file, not about agents, which is why the tier is informative.

## What it checks

One root file, one signal.

| State                                                                                                                                                  | Result                 |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| a 200 response whose body is not HTML, carrying a `Contact` field and an `Expires` date in the future                                                  | `pass`                 |
| a published file that returns HTML at 200 (SPA soft-404), or has no `Contact`, no `Expires`, an unparseable `Expires`, or an `Expires` that has passed | `warn`, priority `low` |
| no security.txt published (non-200 at both locations)                                                                                                  | `na`                   |
| the location was never fetched, so nothing was measured                                                                                                | `na`                   |

`/.well-known/security.txt` is the location checked; the legacy top-level `/security.txt` is accepted as a fallback and named as such in the result. Detection is parse-not-probe by design — this dossier's own evidence records that only a minority of deployed files pass RFC validation, so presence alone proves nothing.

**`fail` is never returned**, and `scoreDisplayMode: 'informative'` with `weight: 0` keeps every outcome out of the category score, the readiness vitals and the top-fails list.

## Scoring

_Superseded on 2026-08-24: the audit's grade is now **C**, taken from the security.txt signal it still measures. The argument below is the 2026-08-22 record of why it was B, and is kept as history — see [Narrowed to security.txt](#narrowed-to-securitytxt-contradiction-sweep-2026-08-24) for why that grade did not survive._

**B — the strongest proven consumer path among the four sources, not the average.**

The security-headers signal shared by 8.2, 8.3 and 8.4 grades **D**. No AI vendor documents any agent reading those headers, so nothing supports shipping the check at all. security.txt (8.7) grades **C**: a real RFC, with real but small adoption of about 1.25% of the top 1M in 2025, and zero AI consumers. The HTTPS/transport-security signal behind HSTS grades **B**: MCP, RFC 9116 and Chromium-based agent surfaces all mandate TLS, which is a documented, testable requirement even though no crawler vendor documents HSTS itself.

Grade B therefore prices the evidence, and `tier: informative` prices the _claim_: `weightForGrade('B', 'informative') === 0`. The grade records what the evidence supports; the tier records that nothing here may move a score. A future task that finds a documented AI consumer for any of these headers can promote the tier without re-grading the evidence.

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** The claim under test: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. Falsifiable form: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies run in the opposite direction from the v1 audits. First, CSP `frame-ancestors` and `X-Frame-Options` can stop a page being embedded in an agent surface, so a strict policy is an agent-readiness negative rather than a positive. Second, OpenAI's Apps SDK shows the agent host imposing CSP on its own widget iframe, which is a property of the app and not of the publisher's site. Third, `X-Content-Type-Options: nosniff` matters only in a browser, and only makes a wrong `Content-Type` more fatal — so it belongs to the content-type signal, not here.

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site. Agent-protocol specs mandate HTTPS outright. Well-known agent and security files are defined as HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour.

**Evidence:** MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS' and 'All redirect URIs MUST be either localhost or use HTTPS'. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and inherit mixed-content blocking, so an HTTP-only page degrades for the fastest-growing agent class.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement, and HSTS specifically has no documented AI consumer at all — the header is a browser-state mechanism layered on top of the TLS the agents actually need. This is why the B grade lives on the transport signal while the audit that reports the header stays informative. The scored HTTPS check itself is `access-crawl-control/https-enabled` (v1 8.1), which this audit does not duplicate.

### Signal: security.txt (/.well-known/security.txt) — grade C (technical-infra)

**Mechanism:** The claim under test: AI agents read /.well-known/security.txt to identify the site operator or a disclosure contact, and its presence improves how agents treat the site.

**Evidence:** security.txt is a real, published IETF document (RFC 9116). It has a well-defined location, a media type (text/plain, UTF-8, HTTPS-only) and required fields (Contact, Expires). Adoption is genuine, if small: roughly 0.7% of the top 1M domains in April 2024, rising to about 1.25% in 2025, with a broader count of about 573,000 domains by 2026.

**Counter-evidence:** RFC 9116 is INFORMATIONAL, explicitly 'not an Internet Standards Track specification'. Its stated consumers are human security researchers and vulnerability-notification tooling; no AI vendor documentation mentions security.txt at all. Conformity is poor — analyses find only a minority of deployed files pass RFC validation, so presence alone is weak evidence of anything. Hence the parse-not-probe detection in this audit, and the informative tier.

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

Carried here only to record where the `nosniff` sub-signal belongs. `X-Content-Type-Options: nosniff` removes a browser's ability to recover from a wrong `Content-Type`; what an agent actually needs is the correct type, which `machine-discovery/ai-file-delivery` (v1 8.10) measures on the AI files themselves. This audit reports `nosniff` on the homepage response as hygiene and makes no parsing claim.

## Implementation deviations

- The audit reads only `ctx.rootFiles`. It no longer reads HSTS, CSP or `X-Content-Type-Options`. Their researched signal is grade D with no AI consumer.
- The grade is C, from security.txt. The B-grade HTTPS signal ships scored as `access-crawl-control/https-enabled`.
- No security.txt, or a location never fetched, is `notApplicable` with distinct messages. A non-conforming file warns at low priority. A valid file passes. `fail` is never returned.
- `nosniff` parsing impact lives in `machine-discovery/ai-file-delivery`. CSP is read only by `operability-safety/third-party-dom-write-blast-radius`.
- The four absorbed v1 dossiers stay in `docs/evidence/merged/operability-safety/`.

## Deferred

- Rename the audit to `operability-safety/security-txt`, with its source, class and dossier.
- Retire 8.2, 8.3 and 8.4 as `removed`, `not-a-factor`, and move their dossiers to `docs/evidence/sunset/`. The hsts-header record must note that the HTTPS signal survives as `access-crawl-control/https-enabled`.
- `docs/evidence/merged/README.md` still cites this audit as a grade-B informative precedent. `machine-discovery/ai-file-delivery.md` still says homepage nosniff hygiene lives here.
- RFC 9116 requires `text/plain` with UTF-8 and HTTPS-only access. Neither is checked.
