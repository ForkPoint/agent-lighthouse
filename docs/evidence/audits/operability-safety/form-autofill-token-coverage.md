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

## Example failure

A signup form uses <input name="f_2" placeholder="ZIP"> and <input name="f_3" placeholder="State"> with no autocomplete and no labels. The agent fills the ZIP into the State field, since both are short free-text inputs adjacent in the DOM, and submits. It gets a red border and a JS-injected sibling <span>Invalid</span> that is not linked by aria-describedby and carries no aria-invalid. The agent's post-action snapshot therefore shows no machine-readable error, and it reports success on a form that never submitted.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

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
