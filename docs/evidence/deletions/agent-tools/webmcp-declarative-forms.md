---
audit: agent-tools/webmcp-declarative-forms
category: agent-tools
status: kept-rewrite
verdict: redeemable
evidence_grade: A
reviewed: 2026-08-21
---

# webmcp-declarative-forms — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **A**.

## Claimed mechanism (steelmanned)

HTML `<form>` elements annotated with `toolname` / `tooldescription` (and `toolparamdescription` / `toolautosubmit`) are automatically synthesized by the browser into WebMCP tools with a JSON Schema, which an in-browser AI agent can then discover via `getTools()` and invoke — without the site writing any JavaScript. For the audit to matter, a real browser must implement the attribute parsing and a real agent must consume the resulting tool list.

## What we searched

WebSearch budget was exhausted at session start, so I researched via direct WebFetch and the GitHub REST API. I enumerated the W3C Web Machine Learning CG repo tree (`gh api repos/webmachinelearning/webmcp/git/trees/main`) and found a dedicated `declarative-api-explainer.md`, which I fetched raw and which defines the exact attributes. I fetched the draft spec at webmachinelearning.github.io/webmcp (section 4.3 'Declarative WebMCP' + 'synthesize a declarative JSON Schema object' algorithm), `implementation-status.md`, developer.chrome.com/docs/ai/webmcp and /declarative-api, and the Chrome origin-trial blog. I ran GitHub code search for `toolname tooldescription language:html` which surfaced a 17-file web-platform-tests suite at `webmcp/declarative/` plus Google's own guidance repo, and I read the raw WPT test `getTools-declarative-schema.https.html` and Google's `guides/webmcp/agentic-forms/guide.md`. Finally I queried the Baseline API at api.webstatus.dev and the chromestatus API for hard implementation/usage/vendor-position data.

## Best evidence found for the audit

Grade-A, multiple independent confirmations. (1) Google's official web-platform status service returns a first-class feature `declarative-webmcp` named literally "Form-associated WebMCP attributes", spec-linked to the WebMCP draft, with WPT pass scores chrome stable 0.6 / chrome experimental 1.0 / edge experimental 0.6 and a live Chrome usage counter of 0.00000274 daily page loads — i.e. Chrome ships and measures it. (2) developer.chrome.com/docs/ai/webmcp/declarative-api documents `toolname`, `tooldescription`, `toolparamdescription`, `toolautosubmit` verbatim with example markup. (3) Google's own guidance repo GoogleChrome/modern-web-guidance-src carries `guides/webmcp/agentic-forms/guide.md` with `web-feature-ids: [declarative-webmcp]`, stating "The Declarative API transforms standard HTML <form> elements into WebMCP tools via attributes. The browser synthesizes a JSON Schema from the form inputs and handles agent interactions." (4) web-platform-tests contains `webmcp/declarative/` with 17 conformance tests; `getTools-declarative-schema.https.html` asserts that `<form toolname="search_tool" tooldescription="Search the web">` yields `tool.name === "search_tool"`. (5) Named consumers: per the CG's `implementation-status.md`, Brave ships "Experimental support ... in Leo AI chat", Chrome has a live Origin Trial in Chrome 149 and Edge in Edge 150. The audit checks exactly the two attributes the spec and Chrome docs define, so the check is faithful to the real signal.

## Counter-evidence

Real but non-fatal. (a) Apple's WebKit standards position on this exact feature is "oppose", citing duplication, i18n, privacy, security, venue, use cases, portability and API design (github.com/WebKit/standards-positions/issues/670, surfaced in the webstatus.dev vendor_positions payload); Mozilla is "neutral" (mozilla/standards-positions#1412). Baseline status is "limited". (b) The normative spec is still incomplete: webmachinelearning.github.io/webmcp §4.3 says "This section is entirely a TODO. For now, refer to the explainer draft." (c) Measured real-world adoption is ~0.0000027 of Chrome page loads, so a FAIL verdict flags essentially every site on the web. (d) Implementation nit found while reading the code: the audit's docsUrl `https://webmcp.link/` returns HTTP 451 Unavailable For Legal Reasons — it should point at https://developer.chrome.com/docs/ai/webmcp/declarative-api. (e) The audit counts a form with only `tooldescription` and no `toolname` as "WebMCP"; per the spec `toolname` is what registers the tool, so a description-only form registers nothing.

## Verdict

**redeemed — keep with rewrite** (grade A)

Grade A. The signal is defined in a W3C Web Machine Learning CG explainer, has a named Baseline web feature (`declarative-webmcp`), a 17-test WPT conformance suite, first-party Chrome documentation with the identical attribute names, and named agent consumers (Brave Leo, Chrome 149 / Edge 150 origin trials). Per the rubric this is redeemable. Recommended fixes rather than deletion: replace the dead webmcp.link docsUrl, require `toolname` (not `tooldescription` alone) to count a form, and soften default priority from 'high' given Baseline 'limited' status and Apple's opposition.

## Sources

- **[WebMCP Declarative API Explainer](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/declarative-api-explainer.md)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Defines toolname, tooldescription, toolautosubmit on <form> and toolparamdescription on form-associated controls. Example: <form toolname="search-cars" tooldescription="Perform a car make/model search"> with toolparamdescription on inputs. Targets <form> and HTML form-associated elements.
- **[Baseline / web-features API: declarative-webmcp — "Form-associated WebMCP attributes"](https://api.webstatus.dev/v1/features?q=webmcp)** — Google / WebDX Community Group (vendor-doc, URL verified 2026-08-21)
  - Named web feature `declarative-webmcp` = "Form-associated WebMCP attributes", spec https://webmachinelearning.github.io/webmcp/. WPT: chrome stable 0.6, chrome experimental 1.0, chrome_android experimental 0.867, edge experimental 0.6, firefox 0, safari 0. Chrome daily usage 0.00000274. Vendor positions: Apple oppose (WebKit standards-positions #670), Mozilla neutral (#1412). Baseline status: limited. Sibling feature document-modelcontext (imperative API) usage 0.00722698.
- **[WebMCP Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)** — Google Chrome Developers (vendor-doc, URL verified 2026-08-21)
  - Documents toolname ("Clearly name the tool, based on its purpose"), tooldescription, toolparamdescription ("Map elements to a property description within the JSON Schema") and toolautosubmit, with a supportRequestTool form example. Published 2026-05-18, under origin trial.
- **[Chrome modern-web-guidance: guides/webmcp/agentic-forms](https://raw.githubusercontent.com/GoogleChrome/modern-web-guidance-src/main/guides/webmcp/agentic-forms/guide.md)** — Google Chrome (GoogleChrome/modern-web-guidance-src) (vendor-doc, URL verified 2026-08-21)
  - web-feature-ids: declarative-webmcp. "The Declarative API transforms standard HTML <form> elements into WebMCP tools via attributes. The browser synthesizes a JSON Schema from the form inputs and handles agent interactions." Documents attribute resolution order (toolparamdescription > <label> textContent > aria-description) and fieldset grouping, plus SubmitEvent.agentInvoked / respondWith().
- **[web-platform-tests: webmcp/declarative/ conformance suite](https://github.com/web-platform-tests/wpt/tree/master/webmcp/declarative)** — web-platform-tests project (repo, URL verified 2026-08-21)
  - 17 test files authored by dom@chromium.org. getTools-declarative-schema.https.html uses <form toolname="search_tool" tooldescription="Search the web"> with toolparamdescription inputs and asserts the browser-synthesized JSON Schema and tool.name/tool.description. Confirms browser-level implementation, not just a proposal.
- **[WebMCP implementation-status.md](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Named consumers: Brave — "Experimental support is added to Leo AI chat"; Chrome — Origin Trial live in Chrome 149; Edge — Origin Trial live in Edge 150. Firefox and Safari still in standards discussion.
- **[Web Model Context API (WebMCP) draft specification](https://webmachinelearning.github.io/webmcp/)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Section 4.3 "Declarative WebMCP" exists but is marked "This section is entirely a TODO. For now, refer to the explainer draft." Defines a "synthesize a declarative JSON Schema object" algorithm over <form> and form-associated inputs. No /.well-known manifest is referenced anywhere in the spec.
- **[WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)** — Google Chrome Developers (announcement, URL verified 2026-08-21)
  - "In Chrome 149, you can sign up for the WebMCP origin trial." Time-limited early-access program.
- **[webmcp.link (docsUrl cited by the audit)](https://webmcp.link/)** — third party (article, NOT verified)
  - (Returns HTTP 451 — the legal-block status IS the observation.) Returns HTTP 451 Unavailable For Legal Reasons — the docsUrl both WebMCP audits point at is dead. Should be replaced with developer.chrome.com/docs/ai/webmcp.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
