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

## Implementation deviations

The shipped audit is `operability-safety/third-party-dom-write-blast-radius`, in
the `operability-safety` category: the proposal's `injection-safety` domain is a
research grouping, not one of the eight v2 categories.

The CSP is read from the response header first and from `<meta http-equiv>`
second. `security-header-hygiene` used to accept the same two delivery paths;
since the contradiction sweep of 2026-08-24 narrowed it to security.txt, this
audit is the only CSP reader in the registry. Nothing was ever imported from
that audit: it asked whether the headers were well-formed, this one asks how
many companies can write to the page.

"Constraining" is decided as CSP3 decides it: a nonce, a hash or
`strict-dynamic` constrains, and so does a plain host allowlist. A source list
containing `https:`, `http:`, `data:`, `blob:` or `*` does not, and neither does
`'unsafe-inline'` with no nonce or hash beside it — that policy is present in
the response and decorative in effect.

Origins are grouped by eTLD+1 using the same short suffix list
`agentic-commerce/acp-policy-link-surface` carries, rather than a bundled Public
Suffix List snapshot. `cdn.vendor.com` and `static.vendor.com` are one company
with write access, so they are one origin.

Cross-origin frames are reported only when they are large enough to render text.
A frame under 50 pixels in either declared direction is a beacon, not a surface
an agent reads.

The `found` line always ends with "runtime-injected tags not counted", so the
number is not read as the whole list.
- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the script origins on the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: redirected
  away pass → na, non-HTML homepage pass → na, HTTP 200 bot challenge pass →
  na. Found by `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — `requires` drops `rendered-body` and `sample-adequate` and is now
  `['origin-reachable', 'unblocked-fetches']`, and the zero-origin branch gains
  a guard. Every origin the served HTML names is counted whether or not the
  body renders, so a page that ships a vendor script statically is still
  reported and gating that on rendered text withheld a real finding. The empty
  census is the half a shell cannot support: same-origin resources are
  discarded from the survey, a JS shell's script tags are its own bundle, and
  the vendors an agent then meets are injected by that bundle at runtime —
  which the `found` string already says this census does not count. Passing
  such a page would assert "nothing but the site itself writes what an agent
  reads" on exactly the page class where a static census is emptiest, so that
  branch now consults `scanReadPageText()` and returns `notApplicable`. Verdict
  on the shell contract state: pass → na, and under the evidence gate the audit
  runs there instead of being skipped. The exemption is recorded in
  `scripts/lib/requires-analysis.mjs`. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Deferred

- **Runtime tag-manager tier.** Tags a manager injects after load are not in the
  served HTML, and that is usually where most of the origin list lives.
  Enumerating them needs a live browser.
- **Whether a script actually writes to the DOM.** Every third-party script
  *can*; proving which ones *do* means executing them. The count is a capability
  measure, which is what the finding claims.
- **Report-only policies.** A `Content-Security-Policy-Report-Only` header
  enforces nothing, so it is not read as a constraint and not reported as one.
