---
audit: operability-safety/third-party-dom-write-blast-radius
category: operability-safety
source_file: packages/core/src/audits/operability-safety/third-party-dom-write-blast-radius.ts
slug: third-party-dom-write-blast-radius
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - mdn-sri
  - mdn-csp
  - brave-comet
  - anthropic-claude-for-chrome
---

# Third-Party DOM-Write Blast Radius

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Quantify how many independent parties can inject text into the DOM that an agent will read. Count distinct third-party script origins lacking integrity= pinning. Evaluate whether a CSP script-src actually constrains them. Enumerate cross-origin iframes lacking sandbox whose text contributes to page reads.

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

## Example failure

A media site loads 14 third-party tags, no CSP, no SRI. One ad-tech vendor is compromised and its script appends an off-screen div to every article. The publisher's own monitoring shows nothing; every AI summary of every article on the domain carries the attacker's sentence until the vendor notices.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The CSP is read from the response header first and from `<meta http-equiv>` second.
- "Constraining" follows CSP3. A nonce, a hash, `strict-dynamic` or a plain host allowlist constrains. A source list with `https:`, `http:`, `data:`, `blob:` or `*` does not. Neither does `'unsafe-inline'` with no nonce or hash beside it.
- Origins are grouped by eTLD+1 with a short suffix list, not a bundled Public Suffix List. `cdn.vendor.com` and `static.vendor.com` count as one origin.
- A cross-origin frame under 50 pixels in either declared direction is a beacon and is not reported.
- The `found` line always ends with "runtime-injected tags not counted".
- `requires` is `origin-reachable` and `unblocked-fetches` only. Every origin the served HTML names is counted even when the body does not render. An empty census on a page with no readable text returns `notApplicable`: a JS shell's vendors arrive at runtime. The exemption is recorded in `scripts/lib/requires-analysis.ts`.
- Messages call each counted origin "a separate host", not "a separate company". A registrable domain is a host, not proof of an owner.

## Deferred

- Runtime tag-manager tier. Tags injected after load are not in the served HTML. Counting them needs a live browser.
- Whether a script actually writes to the DOM. The count is a capability measure, which is what the finding claims.
- `Content-Security-Policy-Report-Only` is not read. It enforces nothing.
- First-party CDNs on another registrable domain stay counted. No cheap, documented signal ties two registrable domains to one owner.
