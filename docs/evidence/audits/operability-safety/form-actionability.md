---
audit: operability-safety/form-actionability
category: operability-safety
source_file: packages/core/src/audits/operability-safety/form-actionability.ts
slug: form-actionability
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs webmcp-input-quality (5.22)"
reviewed: 2026-08-22
sources:
  - anthropic-browser-use-tool
  - playwright-mcp-repo
  - w3c-accname-12
  - webmcp-declarative-explainer
---

# form-actionability (`5.27`, `5.22`)

> operability-safety · source `form-actionability.ts` · merged form audit, absorbs webmcp-input-quality (5.22) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Autonomous agents fill forms by reading the DOM directly — they cannot see placeholders rendered visually or guess what a custom div-based widget expects. Fields without a native element, an explicit label (label[for], wrapping label, aria-label, or aria-labelledby), or a standard autocomplete attribute for identity data (email, phone, name, address) force agents to guess, producing failed or incorrect submissions. Keep every fillable field a native input/select/textarea with an explicit label and standard autocomplete tokens.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Agents that act on a page through its accessibility tree identify a field by its accessible name, computed from `<label>`, `aria-label` or `aria-labelledby`. A fillable control that is not a native form element, or that has no accessible name, cannot be reliably targeted or filled by such an agent.

**Grade: A** — two named agent stacks document that they perceive and act on pages via the accessibility tree, and the accessible name they consume is computed from exactly the label mechanisms this audit checks.

**Evidence:**

- Anthropic's browser use tool "works with the page both through its structure (the accessibility tree, elements, forms, and tabs) and through pixels (screenshots and viewport coordinates)", acting on controls via element references taken from the accessibility tree — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool (verified 2026-08-21)
- Playwright MCP "enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models", and "Uses Playwright's accessibility tree, not pixel-based input" — https://github.com/microsoft/playwright-mcp (verified 2026-08-21)
- The accessible name computation draws on host-language labelling (HTML `<label>`), `aria-label` and `aria-labelledby` — https://www.w3.org/TR/accname-1.2/ (verified 2026-08-21)
- Native form semantics are also what the emerging agent-facing form standard builds on: WebMCP's declarative API compiles `<form>` and its form-associated elements into a tool input schema, using the control's `name` attribute for each schema property — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/declarative-api-explainer.md (verified 2026-08-21)

**Counter-evidence:** Two qualifications. First, the same Anthropic doc shows the agent also has screenshots and viewport coordinates, so a missing accessible name degrades reliability rather than making a field strictly unreachable. Second, the `autocomplete`-token half of this audit is weaker than the label half. The HTML Standard defines autofill detail tokens as a browser autofill feature (https://html.spec.whatwg.org/multipage/form-control-infrastructure.html, verified 2026-08-21), and no vendor doc found states that an AI agent reads `autocomplete` to decide what value to enter. That sub-check is a plausible convention (C) riding on an A-grade label mechanism. `placeholder` is correctly excluded here: it is not part of the accessible name computation (https://www.w3.org/TR/accname-1.2/, verified 2026-08-21).

## The merge (Plan 4, Task 8, 2026-08-22)

5.22 checked the same three things this audit checks — native controls, names, labels — but only inside `form[toolname]`, an attribute no deployed site carries, so it returned `na` on every real scan while consuming runtime and report space. Its required fix is unusually short: _"Merge into 5.27 form-actionability, which already evaluates native elements, label association, and autocomplete on all forms rather than only WebMCP-tagged ones. Carry over nothing but the concept; drop the placeholder-as-label rule, which 5.27 correctly rejects."_

**The concept that carries over is the `name` attribute.** Every fillable field is now required to have one, for two independent reasons: a control with no `name` is not submitted by a plain form at all, and — 5.22's own graded mechanism — WebMCP's declarative API takes each control's `name` as the property name in the tool input schema it generates, so a nameless control is not a callable parameter. When the field sits in a `<form toolname=…>`, the reported reason says so.

**A WebMCP form is just a form.** `<form toolname=…>` no longer routes to a separate audit with different rules; it is evaluated by the same native-element, name, label and autocomplete checks as every other form on the site, which is what 5.22's fix asks for.

**The placeholder rule does not carry over.** 5.22 counted a `placeholder` as a label. `placeholder` is not part of the accessible name computation, it disappears the moment a user or agent types, and this audit's description already told sites they cannot rely on it — so the two audits in one category gave contradictory advice about the same attribute. Only 5.27's position survives.

**The two audits' label-association disagreement is settled: lookup is document-wide.** 5.22 searched the whole document for `label[for=…]`, 5.27 searched inside the `<form>`. HTML permits a `<label for>` anywhere in the document, and layout-driven markup routinely puts it in a sibling grid cell or a `<fieldset>` rendered outside the form, so the document-wide lookup wins and a correctly labelled field in that position is no longer reported unlabelled. This is the only behaviour change in the label-association code.

**The "selector over-escaping" bug named by both 2026-08-20 reviews does not reproduce.** Both dossiers assert that `id.replace(/(["\\\]:])/g, '\\$1')` breaks label lookup for framework ids — that `label[for="form\:email"]` "matches nothing", so JSF/PrimeFaces and ASP.NET WebForms ids are falsely reported unlabelled. Tested against the selector engine this repo actually ships: both `form:email` and `a]b` resolve identically under the old and the new regex. The escape set is narrowed to `"` and `\` here because escaping `:` and `]` inside a quoted value is superfluous, not because it was broken — the change is a simplification with **no behaviour change**, and the required-fix item that motivated it (item 1 in the 2026-08-20 list) was a false positive of that review, kept above as the historical record it is.

### Absorbed evidence — webmcp-input-quality (5.22)

5.22's dossier is kept verbatim at [merged/operability-safety/webmcp-input-quality.md](../../merged/operability-safety/webmcp-input-quality.md) (grade **B**). Its mechanism is real and specified — _"The `name` attribute on form control elements supplies the name of each 'property' in the input schema generated for a declarative tool"_ — with Chrome 149 and Edge 150 origin trials behind it, capped at B because site-side adoption is effectively zero and the input-schema synthesis algorithm is still marked TBD.

Its counter-evidence is what removes the placeholder rule: the spec _"does not derive parameter descriptions from `<label>` and never from `placeholder`"_ — it adds `toolparamdescription` precisely because no description attribute exists to reuse — and the accessible name computation excludes `placeholder` too. So the label/placeholder half of 5.22's score had no consumer at all. Its `docsUrl`, `https://webmcp.link/`, answers HTTP 451.

### Grade decision: stays **A**, tier `scored`, weight 1.0

5.27 grades **A**: two named agent stacks (Anthropic's browser use tool, Playwright MCP) document that they perceive and act on pages through the accessibility tree, and the accessible name they consume is computed from exactly the `<label>`/`aria-label`/`aria-labelledby` mechanisms this audit checks. 5.22 grades **B** on a draft standard with no site adoption, so the absorbed evidence is weaker, not stronger: the grade stays **A**, `tier: scored`, `weightForGrade('A', 'scored')` = **1.0**.

The frontmatter grade was already A; the header line that read "evidence grade **unrated**" was stale and is corrected here. Note the standing qualification from the A grading, unchanged by this merge: the `autocomplete` half of the audit is a plausible convention (C-grade) riding on an A-grade label mechanism, since no vendor documents an agent reading `autocomplete` to decide what value to enter.

### Deviations

- **The remaining items on 5.27's own fix list are not done here.** Fields associated by the `form="id"` attribute are still not collected; `IDENTITY_FIELDS` still matches substrings, so `opacity`/`capacity` still trip the `city` pattern and `company-name` is still told to use `name` rather than `organization`; a dangling `aria-labelledby` reference is still accepted on presence; and a form-less SPA scan is still a plain `na`. Those are the target's standing defects, not the fold's, and each changes scoring for markup neither absorbed audit touched.
- **`type` is still not scored.** 5.22's title promised "name, type, and label" while only ever using `type` to skip non-data inputs; nothing about that promise is inherited.
- **`toolautosubmit`, `tooldescription` and `toolparamdescription` are not evaluated.** They are proposal-stage attributes with no deployed base, and 5.22's fix explicitly says to carry over nothing but the concept.
