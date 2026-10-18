---
audit: operability-safety/form-autofill-token-coverage
category: operability-safety
source_file: packages/core/src/audits/operability-safety/form-autofill-token-coverage.ts
slug: form-autofill-token-coverage
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22; narrowed to credential tokens 2026-10-18 (profile tokens split to profile-autofill-token-coverage)"
reviewed: 2026-10-18
graduated: 2026-08-22
sources:
  - whatwg-autofill
  - webdev-learn-forms-autofill
  - S11
  - lh-a11ytree
  - 1password-compatible-website-design
  - 1password-claude
  - google-chrome-gemini-auto-browse
---

# Form Autofill Token Coverage

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Whether each credential field declares the matching WHATWG `autocomplete` token. Credential fields are the account identifier (`username`), the password (`current-password` on sign-in, `new-password` on sign-up) and the verification code (`one-time-code`). The concept is inferred from the field's type, name, id, placeholder, `aria-label` and label text. A password field expects `new-password` on a signup URL and `current-password` elsewhere.

Contact, address and payment fields are judged by `operability-safety/profile-autofill-token-coverage`. An `email` field on a sign-in form is a profile token and is judged there.

A field counts as covered when all three hold:

- its `autocomplete` token matches the inferred concept;
- it carries a `name` or an `id`;
- the input type matches where the token needs one.

Coverage is one ratio over every scanned form: covered credential fields over credential fields. Search and store-locator forms are skipped.

Two side findings are counted on every data field of a form that carries a credential field:

- a label that marks the field mandatory with an asterisk only, with no `required` or `aria-required="true"`;
- an element with an `error` or `invalid` class, or `role="alert"`, beside the field that the field does not reference through `aria-errormessage` or `aria-describedby`.

| State                                               | Result |
| :-------------------------------------------------- | :----- |
| no form, or no credential field and no side finding | `na`   |
| every credential field covered, no side finding     | `pass` |
| some covered, or all covered with a side finding    | `warn` |
| no credential field covered                         | `fail` |

## Claimed mechanism (falsifiable)

Agents that sign in for a user do not type the password. Gemini in Chrome uses login info saved in Google Password Manager, with permission. Claude fills logins through 1Password, which identifies fields by their `autocomplete` attribute. A sign-in field without `username` or `current-password`, a sign-up field without `new-password`, or a code field without `one-time-code` leaves the password manager guessing. Test: add the correct tokens to a form a password manager fails on and repeat the fill.

## Evidence

- **[HTML Standard — Autofill](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)** — WHATWG (spec, verified 2026-10-17)
  - The `autocomplete` attribute is how a page tells the user agent which value a field wants. The standard defines `username`, `current-password`, `new-password` and `one-time-code`.
- **[Design your website to work best with 1Password](https://www.1password.dev/web/compatible-website-design/)** — 1Password (vendor-doc, verified 2026-10-18)
  - "Use the appropriate autocomplete attributes on fields. These attributes make it easier for 1Password to identify your fields." Its example is `autocomplete="one-time-code"`.
- **[Use 1Password to sign in to websites with Claude](https://support.1password.com/1password-claude/)** — 1Password (vendor-doc, verified 2026-10-18)
  - "1Password for Claude currently supports filling usernames, passwords, and one-time passwords from Login items". Other item types are not supported. This is an agent consumer of exactly the credential tokens.
- **[Use Gemini in Chrome to browse for you](https://support.google.com/chrome/answer/16821166)** — Google (vendor-doc, verified 2026-10-18)
  - "With your permission, it can also use login info you saved in Password Manager to sign into loyalty programs and online accounts."
- **[Learn Forms — Autofill](https://web.dev/learn/forms/autofill)** — Google / web.dev (vendor-doc, verified 2026-10-17)
  - `new-password` lets the browser offer a generated password, and `current-password` a saved one.
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Lighthouse runs axe's `autocomplete-valid` rule, which validates a token that is present and never flags a missing one. This audit measures the missing ones.

Counter-evidence: the agent itself does not read the token. The password manager does, acting for the agent. Agent tools that drive forms directly (`form_input`, Playwright MCP, browser-use) locate fields by accessible name.

## Example failure

A sign-in form uses <input name="f_1" placeholder="Your account"> and <input type="password" name="f_2"> with no autocomplete. The user asks an agent to sign in. The password manager cannot tell which saved login the identifier field wants, offers nothing, and the agent stops at the sign-in page.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

**Grade: A** — the credential tokens are a ratified WHATWG standard with documented agent consumers: 1Password documents identifying fields by `autocomplete` and filling usernames, passwords and one-time passwords for Claude, and Google documents Gemini in Chrome signing in with Google Password Manager (both verified 2026-10-18). The agent reaches the token through the password manager, not directly.

## Implementation deviations

- **Narrowed to credential tokens on 2026-10-18.** The audit used to score
  every autofill token as one ratio at grade A. Only the credential tokens
  have a documented agent consumer, so contact, address and payment tokens
  moved to `operability-safety/profile-autofill-token-coverage` (grade B).
  The survey is shared in `_autofill.ts`. A form's side findings go to this
  audit when the form carries a credential field, and to the profile audit
  otherwise, so nothing is counted twice.

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
