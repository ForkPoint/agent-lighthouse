---
audit: operability-safety/form-actionability
audit_id: "5.27"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/form-actionability.ts
slug: form-actionability
review_verdict: keep
severity: medium
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
---

# form-actionability (`5.27`)

> operability-safety · source `form-actionability.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

## What it checks

Autonomous agents fill forms by reading the DOM directly — they cannot see placeholders rendered visually or guess what a custom div-based widget expects. Fields without a native element, an explicit label (label[for], wrapping label, aria-label, or aria-labelledby), or a standard autocomplete attribute for identity data (email, phone, name, address) force agents to guess, producing failed or incorrect submissions. Keep every fillable field a native input/select/textarea with an explicit label and standard autocomplete tokens.

## Code review findings (2026-08-20, 11-agent pass)

The strongest audit in the category and the one whose passing genuinely improves agent outcomes — native controls, explicit label association, and standard autocomplete tokens are exactly what DOM-driving agents use to fill forms. Keep it; three concrete bugs cause avoidable false failures on real enterprise markup.

**Required fix:** 1) Escape only `"` and `\` in the attribute-selector value (drop `:` and `]` from the regex) so framework ids resolve. 2) Search for `label[for=...]` document-wide (`$(...)`) rather than form-scoped, matching HTML semantics. 3) Include fields associated via the `form` attribute by also selecting `[form="<formId>"]`. 4) Anchor the identity-field patterns to token boundaries (split name/id on `-_. ` and match whole tokens) so `opacity`/`capacity`/`countryside` stop matching, and map `company`/`organization` tokens to `organization`. 5) Verify the `aria-labelledby` target id exists before accepting it. 6) Consider reporting `na` with a note when zero forms are found on a page that ships a heavy JS bundle, so SPA form-less scans are not silently neutral.

**False-positive risks:**
- Selector over-escaping breaks label lookup for framework-generated ids: `id.replace(/(["\\\]:])/g, '\\$1')` (lines 121, 198) escapes `:` and `]`, which require no escaping inside a quoted attribute value. `label[for="form\:email"]` matches nothing, so JSF/PrimeFaces (`form:email`) and ASP.NET WebForms-style ids are reported as 'no explicit label' even when the label is correct and present. Only `"` and `\` need escaping.
- Label lookup is scoped inside the form: `$(formEl).find('label[for="..."]')` (line 199). HTML permits a `<label for>` anywhere in the document, and layout-driven markup (labels in a sibling grid cell, or in a `<fieldset>` rendered outside the form) is common. Correctly labelled fields are flagged as unlabelled.
- Fields associated to a form via the `form="formId"` attribute — outside the `<form>` element — are never counted, so their labels and autocomplete are never evaluated and the form's true actionability is misreported.
- `IDENTITY_FIELDS` substring patterns overmatch: `/city|town/i` matches `name="opacity"`, `name="velocity"`, `name="capacity"`; `/country/i` matches `countryside`; `/street|address/i` matches `addressee` and 'IP address'. Each spurious match demands an autocomplete token on a non-identity field and drags the ratio down.
- `name="company-name"` matches the `name` pattern and is told to use autocomplete="name" when the correct token is `organization`; the field only escapes the flag if it already has some standard token.
- `aria-labelledby` is accepted on presence alone — the referenced id is never checked to exist, so a dangling reference counts as a label (false PASS).
- SPA/CSR pages render forms after hydration; a static scan sees no `<form>` and returns `na`, so the sites most likely to have div-based fake inputs are scored neutral rather than flagged.
- The 0.9 pass threshold means one unlabeled search box on a 10-field page is enough to drop a good site to `warn` at high priority.

**Test gaps:**
- No fixture with an id containing `:` or `]` (JSF/ASP.NET) — the escaping bug is invisible
- No fixture with `<label for>` located outside the `<form>` element
- No fixture using the `form="id"` attribute to associate a field outside its form
- No fixture with `name="opacity"`/`"capacity"` exposing the `city` substring overmatch
- No fixture with a dangling `aria-labelledby` reference
- No SPA/empty-DOM fixture
- No fixture for autocomplete section tokens (`section-blue shipping street-address`) beyond the qualifier list

**Overlaps with:** `5.19`, `5.22`, `5.15`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Agents that act on a page through its accessibility tree identify a field by its accessible name, computed from `<label>`, `aria-label` or `aria-labelledby`; a fillable control that is not a native form element, or that has no accessible name, cannot be reliably targeted or filled by such an agent.

**Grade: A** — two named agent stacks document that they perceive and act on pages via the accessibility tree, and the accessible name they consume is computed from exactly the label mechanisms this audit checks.

**Evidence:**
- Anthropic's browser use tool "works with the page both through its structure (the accessibility tree, elements, forms, and tabs) and through pixels (screenshots and viewport coordinates)", acting on controls via element references taken from the accessibility tree — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)
- Playwright MCP "enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models", and "Uses Playwright's accessibility tree, not pixel-based input" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- The accessible name computation draws on host-language labelling (HTML `<label>`), `aria-label` and `aria-labelledby` — https://www.w3.org/TR/accname-1.2/ (verified 2026-08-21)
- Native form semantics are also what the emerging agent-facing form standard builds on: WebMCP's declarative API compiles `<form>` and its form-associated elements into a tool input schema, using the control's `name` attribute for each schema property — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/declarative-api-explainer.md (verified 2026-08-21)

**Counter-evidence:** Two qualifications. First, the same Anthropic doc shows the agent also has screenshots and viewport coordinates, so a missing accessible name degrades reliability rather than making a field strictly unreachable. Second, the `autocomplete`-token half of this audit is weaker than the label half: the HTML Standard defines autofill detail tokens as a browser autofill feature (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html, verified 2026-08-21), and no vendor doc found states that an AI agent reads `autocomplete` to decide what value to enter — that sub-check is a plausible convention (C) riding on an A-grade label mechanism. `placeholder` is correctly excluded here: it is not part of the accessible name computation (https://www.w3.org/TR/accname-1.2/, verified 2026-08-21).
