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
  - S4
  - S11
  - lh-a11ytree
  - S9
  - S19
---

# Form Autofill Token Coverage

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Per-form score for whether every field an agent must populate carries the machine-readable identity an agent needs:

- a stable name or id;
- a correct input type;
- a WHATWG autocomplete token, when the field maps to a standard autofill concept;
- programmatic constraints;
- error wiring via aria-invalid and aria-describedby. Scored as covered-fields / autofillable-fields per form.

## Claimed mechanism (falsifiable)

Falsifiable claim: an agent filling a checkout must map each field to a value from user profile data. When the field declares autocomplete="postal-code", that mapping is a table lookup against a ratified vocabulary. When it declares name="field_7" with a visual-only label, the mapping is an inference. That inference fails on ambiguous cases: address-line2 against address-level2, cc-exp against bday, tel-national against tel. WebSuite measures the consequence directly: complex form filling succeeds 12.5% and 0% for the two agents tested, against 85%/76% for simple operational clicks. Test: add correct autocomplete tokens to a failing form and re-run the same fill task.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - It filters the accessibility violations Lighthouse already collects down to about 37 axe rules: button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, and the table and definition-list rules. Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[Operator System Card](https://cdn.openai.com/operator_system_card.pdf)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Documents confirmation prompts before 'actions that affect the state of the world (e.g., before completing a purchase or sending an email)', with 92% recall on 607 risky-action tasks and a mistake-risk reduction of about 90%. It also documents watch mode, which forces supervision on high-impact sites, and proactive refusal of high-risk categories. Implication for site authors: an agent must be able to observe and verify state transitions before and after acting, which requires persistent, machine-readable confirmation of what changed.

## Competitor coverage

Partial overlap, deliberately scoped to the gap. Lighthouse's agent-accessibility-tree includes axe's autocomplete-valid and label rules — but autocomplete-valid only validates a token that is ALREADY present and never fires on its absence, and label only demands an accessible name, not a machine-readable concept. Coverage scoring, concept inference, constraint programmability, and error-wiring are unshipped by Lighthouse, Semrush and Ahrefs alike.

## Implementation sketch

Static parse of every <form>. For each control, infer the intended concept from label text, name/id, placeholder and type using a keyword→token map (email→email, zip|postcode|postal→postal-code, phone|tel|mobile→tel, card number|cc-num→cc-number, expiry|exp date→cc-exp, cvv|cvc|security code→cc-csc, address line 2|apt|suite→address-line2, city|town→address-level2, state|province|region→address-level1, first name→given-name, last name|surname→family-name, dob|birth→bday, otp|verification code→one-time-code, password on a login form→current-password, on a signup form→new-password). A field is COVERED when it has an autocomplete attribute whose token equals the inferred token (or is a valid token from the spec list when inference is ambiguous), plus a non-empty name or id, plus a type consistent with the concept (email→type=email, tel→type=tel, otp→inputmode=numeric + autocomplete=one-time-code). Separately flag: required-ness expressed only by a visual asterisk with no required attribute or aria-required; validation constraints expressed only in JS with no pattern/min/max/minlength; error messages rendered as adjacent text with no aria-describedby link and no aria-invalid on the field. Emit form-level score plus a per-field diff table showing expected vs actual token.

## Example failure

A signup form uses <input name="f_2" placeholder="ZIP"> and <input name="f_3" placeholder="State"> with no autocomplete and no labels. The agent fills the ZIP into the State field, since both are short free-text inputs adjacent in the DOM, and submits. It gets a red border and a JS-injected sibling <span>Invalid</span> that is not linked by aria-describedby and carries no aria-invalid. The agent's post-action snapshot therefore shows no machine-readable error, and it reports success on a form that never submitted.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

None. The sketch names no dependency outside the repo: concept inference reads
the label, `name`, `id`, `placeholder` and `aria-label` through the cheerio
document the scanner already parses.

Two sketch details were tightened during implementation:

- **Password token.** The sketch keys `current-password` vs `new-password` off
  "a login form" vs "a signup form". The implementation keys it off the page
  URL (`/signup`, `/register`, `/create-account`, `/join` against `/login`,
  `/signin`, `/auth`), because a served document carries no other reliable
  marker of which one it is. An unrecognisable URL defaults to
  `current-password`, the more common case.
- **Prefixed tokens.** `autocomplete="billing postal-code"` and
  `autocomplete="shipping tel"` are valid WHATWG values. Coverage compares the
  final token, so a section- or address-type prefix does not read as a miss.

## Deferred

- **Constraint programmability.** The sketch also asks for "validation
  constraints expressed only in JS with no pattern/min/max/minlength". Deciding
  that a constraint exists _only_ in JS requires executing the page's scripts,
  which is the headless-browser tier. The static half — that a field carries no
  `pattern`/`min`/`max`/`minlength` at all — is not reported, because on its own
  it cannot distinguish an unconstrained field from a field with no constraint
  to express.
- **Per-field diff table.** The sketch asks for a per-field expected-vs-actual
  table. The result surface carries one `found` string; the audit reports the
  coverage ratio plus the first uncovered field as an example. A structured
  per-field table is a report-format change, tracked for Plan 6.
