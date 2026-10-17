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

## Implementation deviations

- Every fillable field needs a `name`. A plain form does not submit a nameless control, and WebMCP's declarative API uses `name` as the tool input property. A field in a `<form toolname=…>` reports the WebMCP reason.
- A `<form toolname=…>` is evaluated by the same rules as every other form.
- `placeholder` never counts as a label. It is not part of the accessible name computation.
- `label[for]` lookup is document-wide, as HTML permits.
- The `autocomplete` half is a convention (C) riding on the A-grade label mechanism. No vendor documents an agent reading `autocomplete`.
- `type` is not scored. It only skips non-data inputs.
- `toolautosubmit`, `tooldescription` and `toolparamdescription` are not evaluated.

## Deferred

- Fields associated by the `form="id"` attribute are not collected.
- `IDENTITY_FIELDS` matches substrings, so `capacity` trips the `city` pattern and `company-name` is told to use `name` rather than `organization`.
- A dangling `aria-labelledby` reference is accepted on presence.
- A form-less SPA scan is a plain `notApplicable`.
