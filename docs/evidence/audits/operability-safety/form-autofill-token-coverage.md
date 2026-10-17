---
audit: operability-safety/form-autofill-token-coverage
category: operability-safety
source_file: packages/core/src/audits/operability-safety/form-autofill-token-coverage.ts
slug: form-autofill-token-coverage
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - whatwg-autofill
  - webdev-learn-forms-autofill
  - S11
  - lh-a11ytree
---

# Form Autofill Token Coverage

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Whether each form field that maps to a standard autofill concept declares the matching WHATWG `autocomplete` token. The concept is inferred from the field's type, name, id, placeholder, `aria-label` and label text. A password field expects `new-password` on a signup URL and `current-password` elsewhere.

A field counts as covered when all three hold:

- its `autocomplete` token matches the inferred concept;
- it carries a `name` or an `id`;
- an `email` or `tel` concept sits on an input of that type.

Coverage is one ratio over every scanned form: covered fields over autofillable fields. Search and store-locator forms are skipped, because their fields take a query, not profile data.

Two side findings are counted on every data field, whether or not it maps to a concept:

- a label that marks the field mandatory with an asterisk only, with no `required` or `aria-required="true"`;
- an element with an `error` or `invalid` class, or `role="alert"`, beside the field that the field does not reference through `aria-errormessage` or `aria-describedby`.

The audit does not read `aria-invalid`, and it does not check programmatic constraints such as `pattern` or `min`.

- No form, or no autofillable field and no side finding, is not applicable.
- Every field covered and no side finding passes.
- No autofillable field covered fails.
- Anything between warns, including a fully covered form with a side finding.

## Claimed mechanism (falsifiable)

Falsifiable claim: an agent filling a checkout must map each field to a value from user profile data. When the field declares autocomplete="postal-code", that mapping is a table lookup against a ratified vocabulary. When it declares name="field_7" with a visual-only label, the mapping is an inference. That inference fails on ambiguous cases: address-line2 against address-level2, cc-exp against bday, tel-national against tel. WebSuite measures the consequence directly: complex form filling succeeds 12.5% and 0% for the two agents tested, against 85%/76% for simple operational clicks. Test: add correct autocomplete tokens to a failing form and re-run the same fill task.

## Evidence

- **[HTML Standard — Autofill](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)** — WHATWG (spec, verified 2026-10-17)
  - "User agents sometimes have features for helping users fill forms in". The `autocomplete` attribute is how a page tells the user agent which value a field wants. The standard defines the token vocabulary this audit expects, including `postal-code`, `address-level2`, `cc-number`, `one-time-code`, `new-password` and `current-password`.
- **[Learn Forms — Autofill](https://web.dev/learn/forms/autofill)** — Google / web.dev (vendor-doc, verified 2026-10-17)
  - "Using the correct values for `autocomplete` ensures that the browser fills in the correct values for a form." `new-password` lets the browser offer a generated password, and `current-password` a saved one. Browser-resident agents fill through the same browser.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-10-17)
  - Complex form filling succeeded 12.5% for natbot and 0% for SeeAct over 8 trials each, against 85.2% and 76.2% for operational actions. The study does not isolate the `autocomplete` attribute, so it shows the size of the problem, not this fix's effect.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Lighthouse's agentic category runs axe's `autocomplete-valid` rule. That rule validates a token that is present and never flags a missing one. This audit measures the missing ones.

Counter-evidence: no cited agent tool documents reading `autocomplete` directly. Anthropic's `form_input`, Playwright MCP and browser-use locate fields by accessible name. The token is consumed by the browser's own autofill.

## Example failure

A signup form uses <input name="f_2" placeholder="ZIP"> and <input name="f_3" placeholder="State"> with no autocomplete and no labels. The agent fills the ZIP into the State field, since both are short free-text inputs adjacent in the DOM, and submits. It gets a red border and a JS-injected sibling <span>Invalid</span> that is not linked by aria-describedby and carries no aria-invalid. The agent's post-action snapshot therefore shows no machine-readable error, and it reports success on a form that never submitted.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

**Grade: A** — the token vocabulary is a ratified WHATWG standard, and browsers document consuming it for autofill. The grade rests on that standard-with-consumers path. No agent vendor documents reading the token itself.

## Implementation deviations

- The password token is keyed off the page URL. Signup paths (`/signup`, `/register`, `/create-account`, `/join`) expect `new-password`. Any other page expects `current-password`, the more common case.
- Coverage compares the bare token. A section, `billing` or `shipping` prefix does not read as a miss.
- Search and store-locator forms are skipped. Their fields take a query, not profile data. A form is skipped when it has `role="search"`, sits in a search landmark, holds an `input type="search"`, or its action path, name or id reads as search, locator or stores.
- "find" is not a skip keyword. Checkout postcode-lookup forms are often named "find address" and still owe the token.
- A location field whose name offers a choice ("City or postcode") is not counted. Two names for one concept ("State or province") still are.
- A scan whose only candidate fields sit in skipped forms is not applicable.
- Browser snapshots reuse the audit on each complete, unredacted, non-loading capture with readable text. The finding is informative with weight 0 and claims nothing about live form state or task success. Truncated, redacted and still-loading captures produce missing-evidence records. The eligibility record is in `packages/core/src/snapshot-eligibility.ts`.

## Deferred

- Constraint programmability. Telling that a constraint exists only in JS needs the page's scripts to run. A field with no `pattern`, `min`, `max` or `minlength` is not reported on its own.
- A per-field expected-vs-actual table. The result reports the coverage ratio and the first uncovered field.
