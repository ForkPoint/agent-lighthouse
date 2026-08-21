---
audit: agent-tools/form-actionability
audit_id: "5.27"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/form-actionability.ts
slug: form-actionability
review_verdict: keep
severity: medium
evidence_grade: unrated
disposition: "keep"
reviewed: 2026-08-21
---

# form-actionability (`5.27`)

> agent-tools · source `form-actionability.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

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
