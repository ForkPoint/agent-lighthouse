---
audit: operability-safety/forms-no-js
category: operability-safety
source_file: packages/core/src/audits/operability-safety/forms-no-js.ts
slug: forms-no-js
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - vercel-rise-of-ai-crawler
  - anthropic-browser-use-tool
  - playwright-mcp-repo
---

# forms-no-js (`5.19`)

> operability-safety · source `forms-no-js.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Many AI agents do not execute JavaScript, so forms that rely on JS for submission are invisible to them. Adding standard HTML action and method attributes ensures forms work via simple HTTP requests, making them accessible to all AI agents.

## Code review findings (2026-08-20, 11-agent pass)

Sound premise for non-JS agents, but the pass condition depends on an attribute that is optional-by-design, and it treats a legal empty action as missing — so standards-compliant self-posting forms are marked as requiring JavaScript.

**Required fix:** Treat a missing/empty `action` as valid self-posting (it is) and instead flag the real failure mode: a form whose submit path is JS-only — no action AND no method AND a `type="button"`/`onclick` submit control, or a `<form onsubmit="...return false">`. Check `formaction` on submit buttons. Remove the dead `formsWithMethod` gate or make it meaningful. Detect known third-party form embeds and report them explicitly instead of scoring `na`. Drop the `v8 ignore` block so the logic is actually exercised.

**False-positive risks:**
- `if (form.action && form.action !== '')` — `<form method="post">` with no action submits to the current URL, which is valid HTML and works perfectly without JavaScript. It is counted as action-less and, if it is the only form, produces 'None of the N form(s) have an action attribute — they require JavaScript to submit', which is factually false.
- Pass requires `formsWithAction === totalForms && formsWithMethod === totalForms`, but parser.ts:400 defaults `method` to 'GET' when absent, so `formsWithMethod` is always equal to totalForms — the method half of the condition is dead code that can never fail. The audit advertises checking two attributes and effectively checks one.
- `formaction` on the submit button (a legal way to target an endpoint) is never inspected.
- SPA/CSR sites render forms client-side, so `extractForms` finds zero forms → `notApplicable`. The audit is silent on exactly the sites whose forms most need JavaScript — the worst offenders score neutral.
- Third-party embedded forms (HubSpot/Typeform/Mailchimp iframes) are invisible, so a site whose only lead-capture path is JS-dependent scores `na`.
- `/* v8 ignore start */` at line 45 suppresses coverage on the method-counting and firstPageUrl branches, hiding the dead-condition bug from the test suite.

**Test gaps:**
- No `<form method="post">` (empty action) fixture — the main false positive
- No `formaction`-on-button fixture
- No SPA fixture where forms exist only after hydration
- No iframe/third-party form fixture
- The dead `formsWithMethod` condition is untested and coverage-suppressed

**Overlaps with:** `5.15`, `5.27`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** An AI client that does not execute JavaScript cannot submit a form whose only submission path is a JS event handler; giving the form a server-side HTML submission path makes it actionable over plain HTTP.

**Grade: C** — the "AI crawlers do not run JavaScript" half is well measured. But no documented agent submits HTML forms over raw HTTP, and the specific attribute this audit scores, `action`, does not distinguish a JS-only form from a standards-compliant self-posting one. The causal link from signal to consumer is therefore unproven.

**Evidence:**
- Vercel's crawler study finds "none of the major AI crawlers currently render JavaScript", naming OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Meta-ExternalAgent, Bytespider and PerplexityBot; ChatGPT (11.50%) and Claude (23.84%) fetch JS files but do not execute them — https://vercel.com/blog/the-rise-of-the-ai-crawler (verified 2026-08-21)
- Those same non-rendering clients are retrieval crawlers, not form submitters. The agents that actually fill and submit forms drive a real, JS-executing browser. Anthropic's browser use tool works "through its structure (the accessibility tree, elements, forms, and tabs) and through pixels" — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)
- Playwright MCP likewise drives a real browser and exposes structured accessibility snapshots to the model — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)

**Counter-evidence:** The HTML Standard makes the graded attribute optional by design — in the form submission algorithm, if the action attribute "is null or attribute's value is the empty string, then return this's node document's URL" (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html, verified 2026-08-21). A `<form method="post">` with no action is fully functional without JavaScript, so a missing `action` is not evidence of JS dependence. No vendor documents an agent that POSTs a form from parsed HTML without a browser, and every documented form-filling agent executes JavaScript — which removes the harm this audit's failure state describes.

## Deferred

- **Unescaped `id` in `extractForms`.** The shared form parser builds a
  selector from a page-supplied `id` to find a control's label, the
  `label[for="..."]` lookup in `parser.ts`. An `id` carrying a quote or a
  backslash makes css-what throw inside `$()`; the throw escapes
  `extractForms`, so both audits that consume it — `forms-no-js` and
  `contact-form` — become `scan-error` stubs and the site is told nothing
  about either. No corpus fixture carries such an `id`, so nothing throws
  today; the class is live and latent. Two audits in this category already
  escape their interpolated values (`form-actionability` has
  `escapeAttrValue`, `form-autofill-token-coverage` has `cssEscape`), so the
  fix is to reuse one at the parser call site. Found by the real-page corpus
  snapshot, which caught the same shape throwing for real in
  `answer-readiness/extractor-survival-recall`.
