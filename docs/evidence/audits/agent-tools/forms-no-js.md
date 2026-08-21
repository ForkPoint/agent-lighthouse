---
audit: agent-tools/forms-no-js
audit_id: "5.19"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/forms-no-js.ts
slug: forms-no-js
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# forms-no-js (`5.19`)

> agent-tools · source `forms-no-js.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
