---
audit: agent-interfaces/webmcp-declarative-forms
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/webmcp-declarative-forms.ts
slug: webmcp-declarative-forms
evidence_grade: B
disposition: "kept — rewritten to the W3C/Baseline declarative-webmcp attributes 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
signals:
  - name: declarative WebMCP attributes read by the browser
    grade: B
    domain: agent-tools
sources:
  - chrome-docs-declarative-api
  - webmcp-spec-no-nav
---

# webmcp-declarative-forms (`5.21`)

> agent-interfaces · source `webmcp-declarative-forms.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

## What it checks

WebMCP's Declarative API lets you expose HTML forms as agent-callable tools by adding toolname and tooldescription attributes. AI agents can then discover and invoke these forms without JavaScript, using standard HTML semantics.

## Implementation deviations

- No forms, or forms with none of `toolname`, `tooldescription`, `toolparamdescription` or `toolautosubmit`, is `notApplicable`. A site using the imperative API carries none of them and is still agent-callable.
- Only a non-empty `toolname` registers a tool. Markup without one fails when no form is named, and is called out as registering nothing.
- Partial coverage warns. "Every form should be a tool" is still the pass bar, though a login or newsletter form may not be one a site wants agents to drive.
- A named form without `tooldescription` warns.
- `toolparamdescription` coverage is reported in `found` and never gates the status.
- The grade is B because the API is an origin trial. It becomes an A candidate if the trial ships or the W3C work is ratified.

## Evidence

### Signal: declarative WebMCP attributes read by the browser — grade B (agent-tools)

**Mechanism:** A form annotated with the declarative WebMCP attributes is registered by the browser as an agent-callable tool. An agent that wants to act on the page therefore gets a described tool with typed parameters, instead of having to infer a form's purpose from its markup.

**Grade: B** — Chrome documents its own browser reading the attributes, which is documented consumer behaviour. But the API is an origin trial rather than a shipped one, and Chrome says it is "under active discussion and subject to change". That is a draft standard with adoption, not a ratified one.

**Evidence:**

- Chrome's declarative-API page (published 2026-05-18) documents `toolname` and `tooldescription` on `<form>`, `toolparamdescription` on individual form elements, and `toolautosubmit` — https://developer.chrome.com/docs/ai/webmcp/declarative-api (verified 2026-08-24)
- The same page states the consuming behaviour directly: "The browser interprets this form as a tool", and "When an agent calls `toolname`, the browser brings the form into focus and populates its field."
- The attribute set is the W3C Web Machine Learning Community Group's, so the browser is implementing a group specification rather than a private vendor extension — https://webmachinelearning.github.io/webmcp/ (verified 2026-08-21)

**Counter-evidence:** The page carries an origin-trial badge and states that "WebMCP is under active discussion and subject to change in the future", so both the attribute names and the registration behaviour can move. The declarative path is also the younger of the two: the imperative `navigator.modelContext` registration is what Lighthouse reports on, and this project's own `agent-interfaces/webmcp-registered-tools` covers it at `experimental` precisely because a scanner with no JavaScript runtime cannot observe it. No adoption measurement exists for the declarative attributes on the public web. A site that implements WebMCP imperatively will carry none of them, and still be fully agent-callable. That is why a page with no form at all is not applicable here, rather than a failure.
