---
check: third-party-dom-write-blast-radius
title: "Third-Party DOM-Write Blast Radius"
domain: injection-safety
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Third-Party DOM-Write Blast Radius

> Proposed check. Evidence grade **B** · partial overlap · implementation: `static-fetch`

## What it checks

Quantify how many independent parties can inject text into the DOM that an agent will read: count distinct third-party script origins lacking integrity= pinning, evaluate whether a CSP script-src actually constrains them, and enumerate cross-origin iframes lacking sandbox whose text contributes to page reads.

## Claimed mechanism (falsifiable)

An agent reads the page after load, so every origin that can execute script on it can decide what the agent sees at read time. SRI exists precisely because 'if an attacker gains control of the third-party host, then they can inject arbitrary malicious content into its files', and CSP script-src exists to bound which scripts run at all. A page with a dozen unpinned, unconstrained third-party tags has a dozen independent parties who can each publish instructions on the owner's domain to every visiting agent, with the owner unable to observe or audit it. Falsifier: a page whose script execution is nonce- or hash-gated and whose third-party subresources are hash-pinned has no unaudited DOM-write path.

## Evidence

- **[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)** — MDN / Mozilla (vendor-doc, URL verified 2026-08-20)
  - integrity= pins a cryptographic hash on <script> and <link>; the browser refuses the resource on mismatch. Explicit threat model: 'if an attacker gains control of the third-party host, then they can inject arbitrary malicious content into its files.' Quantifies the unpinned third-party surface that can write into the DOM an agent later reads.
- **[Content Security Policy guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)** — MDN / Mozilla (vendor-doc, URL verified 2026-08-20)
  - script-src constrains which JS may load and execute (blocking external attacker-controlled scripts, inline scripts, inline handlers, javascript: URLs, eval); strict CSP with nonces/hashes is recommended over allowlists. frame-ancestors addresses framing. Gives a machine-checkable definition of 'this page's DOM writers are constrained'.
- **[Comet Prompt Injection: Agentic Browser Security](https://brave.com/blog/comet-prompt-injection/)** — Brave Software (article, URL verified 2026-08-20)
  - Perplexity Comet fed page content to its LLM without separating user instructions from page data. Injection was hidden in a Reddit comment behind a spoiler tag; Brave explicitly names 'white text on white backgrounds, HTML comments, or other invisible elements' as the hiding techniques. PoC chain: agent read hidden instructions from UGC, pulled the user's email from their Perplexity account, triggered an OTP, read the OTP from the already-logged-in Gmail tab, and posted both back to Reddit. Establishes UGC on a third-party site as a live injection surface.
- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Red-team attack success rate 23.6% in autonomous browsing mode, 11.2% after mitigations; a browser-specific challenge set went 35.7% -> 0%. Names the exact vectors: 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' This is the vendor-documented basis for auditing hidden inputs and a11y/metadata attributes.

## Competitor coverage

CSP and SRI presence are primitives already covered by Mozilla Observatory, securityheaders.com, and Lighthouse's best-practices CSP-XSS audit — the underlying checks are commodity, and this proposal should be graded honestly as partial-overlap rather than novel. What is not shipped anywhere: framing the metric as a count of independent parties who can write into the agent-visible DOM, folding in unsandboxed text-bearing iframes, and reporting the named origin list as agent-safety exposure rather than as an XSS grade.

## Implementation sketch

Parse Content-Security-Policy from both the response header and <meta http-equiv>. Evaluate script-src (falling back to default-src): does it exist; does it use nonce-, sha256/384/512-, or 'strict-dynamic'; does it contain 'unsafe-inline', 'unsafe-eval', a bare *, data:, or https: as a scheme-wide source (all of which reduce it to decorative). Enumerate <script src> and <link rel=stylesheet> whose host differs in eTLD+1 from the document, group by registrable domain, and record which carry integrity=. Enumerate cross-origin <iframe> and record whether each has a sandbox attribute and whether its dimensions suggest rendered text rather than a tracking pixel. Score: FAIL when >=1 third-party script origin exists AND script-src is absent or non-constraining AND no third-party script carries integrity. WARN by tier on the count of uncontrolled origins (1–3 / 4–9 / 10+). Always emit the actual origin list — the deliverable is 'these eleven companies can each write text into what agents read on your site', which is the finding a site owner can act on. Headless-browser tier extends this to tags injected at runtime by tag managers, which is where the real count usually lives.

## Example failure

A media site loads 14 third-party tags, no CSP, no SRI. One ad-tech vendor is compromised and its script appends an off-screen div to every article. The publisher's own monitoring shows nothing; every AI summary of every article on the domain carries the attacker's sentence until the vendor notices.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
