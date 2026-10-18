---
audit: operability-safety/profile-autofill-token-coverage
category: operability-safety
source_file: packages/core/src/audits/operability-safety/profile-autofill-token-coverage.ts
slug: profile-autofill-token-coverage
evidence_grade: C
tier: informative
disposition: "new 2026-10-18 — split from form-autofill-token-coverage, which keeps the credential tokens; graded C informative after the 2026-10-18 review"
reviewed: 2026-10-18
sources:
  - whatwg-autofill
  - webdev-learn-forms-autofill
  - 1password-compatible-website-design
  - S11
  - simonwillison-chatgpt-atlas
---

# Profile Autofill Token Coverage

> New in 9.0.0. Evidence grade **C** · informative tier (weight 0) · implementation: `static-fetch`

## What it checks

Whether each contact, address and payment field declares the matching WHATWG `autocomplete` token: `email`, `tel`, `name`, `given-name`, `family-name`, `organization`, `bday`, `address-line1`, `address-line2`, `address-level1`, `address-level2`, `postal-code`, `country-name`, `cc-name`, `cc-number`, `cc-exp` and `cc-csc`. The concept is inferred from the field's type, name, id, placeholder, `aria-label` and label text.

Sign-in, sign-up and one-time-code fields are judged by `operability-safety/form-autofill-token-coverage`. So is the first email field of a sign-in or sign-up form with a password field and no separate username field: there the email is the account identifier.

A field counts as covered when all three hold:

- its `autocomplete` token matches the inferred concept;
- it carries a `name` or an `id`;
- an `email` or `tel` concept sits on an input of that type.

Coverage is one ratio over every scanned form: covered profile fields over profile fields. Search and store-locator forms are skipped, because their fields take a query, not profile data. A location field whose label offers a choice ("City or postcode") is not counted.

Two side findings are counted on every data field of a form that carries no credential field:

- a label that marks the field mandatory with an asterisk only, with no `required` or `aria-required="true"`;
- an element with an `error` or `invalid` class, or `role="alert"`, beside the field that the field does not reference through `aria-errormessage` or `aria-describedby`.

| State                                            | Result |
| :----------------------------------------------- | :----- |
| no form, or no profile field and no side finding | `na`   |
| every profile field covered, no side finding     | `pass` |
| some covered, or all covered with a side finding | `warn` |
| no profile field covered                         | `fail` |

## Claimed mechanism (falsifiable)

Browser autofill and password managers map each field to a stored profile value by its `autocomplete` token. When a field declares `autocomplete="postal-code"`, the mapping is a lookup against a ratified vocabulary. When it declares `name="field_7"` with a visual-only label, the mapping is a guess that fails on ambiguous cases: `address-line2` against `address-level2`, `cc-exp` against `bday`. Test: add correct tokens to a form that autofill fills wrongly and repeat the fill.

## Evidence

- **[HTML Standard — Autofill](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)** — WHATWG (spec, verified 2026-10-17)
  - The `autocomplete` attribute is how a page tells the user agent which value a field wants. The standard defines the contact, address and payment tokens this audit expects.
- **[Learn Forms — Autofill](https://web.dev/learn/forms/autofill)** — Google / web.dev (vendor-doc, verified 2026-10-17)
  - "Using the correct values for `autocomplete` ensures that the browser fills in the correct values for a form."
- **[Design your website to work best with 1Password](https://www.1password.dev/web/compatible-website-design/)** — 1Password (vendor-doc, verified 2026-10-18)
  - "Use the appropriate autocomplete attributes on fields. These attributes make it easier for 1Password to identify your fields."
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-10-17)
  - Complex form filling succeeded 12.5% and 0% for the two agents tested, against 85.2% and 76.2% for operational actions. The study does not isolate the `autocomplete` attribute, so it shows the size of the problem, not this fix's effect.

Counter-evidence: no AI agent documents filling profile, address or payment data. 1Password's Claude integration fills "usernames, passwords, and one-time passwords from Login items" only. ChatGPT Atlas agent mode is reported to be unable to "access saved passwords, or use autofill data", quoted from OpenAI's release notes in https://simonwillison.net/2025/Oct/21/introducing-chatgpt-atlas/ (verified 2026-10-18). The OpenAI help page itself returned HTTP 403 to a scripted fetch and is not verified here.

## Example failure

A checkout form uses `<input name="f_2" placeholder="ZIP">` and `<input name="f_3" placeholder="State">` with no autocomplete and no labels. Browser autofill offers nothing, or fills the ZIP into the State field, since both are short free-text inputs adjacent in the DOM. An agent driving the same browser inherits the same blank or wrong fields.

## Scoring

Informative (weight 0). It reports coverage and never moves a score.

**Grade: C** — the tokens are a ratified WHATWG standard, and browsers and password managers document filling by them for people. No AI agent documents filling profile, address or payment data, and ChatGPT Atlas is reported to exclude it. The agent path is plausible but unproven, which the evidence policy grades C.

## Implementation deviations

- **Split from `form-autofill-token-coverage` on 2026-10-18.** The survey is
  shared in `_autofill.ts`. A form's side findings go to the credential audit
  when the form carries a credential field, and here otherwise, so nothing is
  counted twice.
- On a form with a password field and no username field, the email field is
  the account identifier and is judged by the credential audit, not here. The
  recommended `type="email" autocomplete="username"` pattern used to read as a
  wrong token here (2026-10-18 review). A signup form that also asks for a
  username keeps its email here.
- 2026-10-18 review: grade B to C and scored to informative. Its own
  counter-evidence says no AI agent fills profile data, which is the policy's
  C, not B.
- Coverage compares the bare token. A section, `billing` or `shipping` prefix
  does not read as a miss.
- Search and store-locator forms are skipped. A form is skipped when it has
  `role="search"`, sits in a search landmark, holds an `input type="search"`,
  or its action path, name or id reads as search, locator or stores. "find" is
  not a skip keyword: checkout postcode-lookup forms are often named "find
  address" and still owe the token.
- Browser snapshots run this audit on complete, unredacted, non-loading
  captures, like the credential audit. The finding is informative with weight 0.

## Deferred

- Constraint programmability. A field with no `pattern`, `min`, `max` or
  `minlength` is not reported on its own.
- A per-field expected-vs-actual table. The result reports the coverage ratio
  and the first uncovered field.
- Re-grade if an agent vendor documents filling profile or payment data.
