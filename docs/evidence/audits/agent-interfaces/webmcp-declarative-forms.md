---
audit: agent-interfaces/webmcp-declarative-forms
audit_id: "5.21"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/webmcp-declarative-forms.ts
slug: webmcp-declarative-forms
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewritten to the W3C/Baseline declarative-webmcp attributes 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
---

# webmcp-declarative-forms (`5.21`)

> agent-interfaces · source `webmcp-declarative-forms.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

## What it checks

WebMCP's Declarative API lets you expose HTML forms as agent-callable tools by adding toolname and tooldescription attributes. AI agents can then discover and invoke these forms without JavaScript, using standard HTML semantics.

## Code review findings (2026-08-20, 11-agent pass)

Checks for `toolname`/`tooldescription` HTML attributes that do not exist in any specification and are invalid HTML. It hard-fails at high priority every site that has a form, and its partial-credit logic lets a form with only a description and no tool name produce a full pass.

**Required fix:** Delete with the rest of the WebMCP cluster. The legitimate underlying question — 'can an agent understand and submit this form' — is already covered properly by 5.27 form-actionability using real HTML semantics (labels, autocomplete, native controls).

**False-positive risks:**
- Universal false fail: `toolname`/`tooldescription` are not part of the WebMCP proposal, HTML, or any registered microsyntax. Every real site with forms gets 'Found N form(s) but none have WebMCP toolname/tooldescription attributes' at high priority — a top-level recommendation to add invalid, inert markup.
- Logic hole: a form with `tooldescription` but NO `toolname` increments `webmcpForms` (lines 58-62). With one such form, `webmcpForms === totalForms` → PASS, message 'All 1 form(s) have WebMCP attributes' with an empty tools list. The test at line 82 codifies this as expected behavior. A nameless tool is not callable by anything.
- `warn` (not `na`) when a page has no forms at all — a documentation site or blog is penalized for not having forms to annotate, muddying the score with a non-signal.
- Would-be positives are unattainable: a site implementing real WebMCP via JS registers tools at runtime and has no such attributes, so correct implementations also fail.

**Test gaps:**
- No test recognizing that these attributes are non-standard
- The description-only-pass hole is tested as correct behavior rather than flagged
- No test asserting `na` (not `warn`) is right for form-less pages

**Overlaps with:** `5.20`, `5.22`, `5.23`, `5.24`, `5.25`

## The rewrite (Plan 4, Task 10, 2026-08-22)

**First, a correction to the code review above.** Its central claim — that `toolname`/`tooldescription` "do not exist in any specification" — is factually wrong and the [redemption research](../../deletions/agent-tools/webmcp-declarative-forms.md) refuted it. The attributes are defined verbatim in the W3C Web Machine Learning CG's `declarative-api-explainer.md`, documented verbatim on `developer.chrome.com/docs/ai/webmcp/declarative-api`, carried by the named Baseline web feature `declarative-webmcp` ("Form-associated WebMCP attributes"), and asserted by a 17-test WPT conformance suite whose `getTools-declarative-schema.https.html` checks that `<form toolname="search_tool" tooldescription="Search the web">` yields `tool.name === "search_tool"`. The audit was checking real attribute names all along. What it got wrong was the pass logic and its metadata.

The dossier's three recommended fixes all land:

**1. The dead docsUrl is replaced.** `https://webmcp.link/` returns HTTP 451 Unavailable For Legal Reasons; `docsUrl` now points at `https://developer.chrome.com/docs/ai/webmcp/declarative-api`.

**2. `toolname` is required to count a form.**

- *Old pass condition:* a form counted as WebMCP if it had `toolname` **or** `tooldescription`. A single description-only form therefore satisfied `webmcpForms === totalForms` and produced "All 1 form(s) have WebMCP attributes" with an empty tool list — and the old test suite codified that hole as expected behaviour.
- *New pass condition:* only a non-empty `toolname` registers a tool, which is what the spec algorithm and the WPT assertion say. Forms carrying `tooldescription` or `toolparamdescription` without a `toolname` are counted separately and called out in the message as markup that registers nothing.

A named form with no `tooldescription` is now a `warn`: it is registered but an agent has nothing to select it on. `toolparamdescription` coverage across named forms is reported in the `found` line as the schema-quality signal it is, without gating the status.

**3. `defaultPriority` is softened from `high` to `medium`**, given Baseline "limited" status, Chrome 149 / Edge 150 origin trials rather than stable shipping, and Apple's "oppose" WebKit standards position.

**Also fixed: a form-less page is `na`, not `warn`.** A documentation site or a blog has nothing to annotate, and scoring it for the forms it does not have measures the site's genre rather than its agent-readiness.

**Guidance and code sample** now name all four attributes the explainer defines — `toolname`, `tooldescription`, `toolparamdescription` (on form-associated controls) and `toolautosubmit` — with a note to keep `toolautosubmit` off anything that changes state. The `chrome-146` tag, which named a version that has nothing to do with this feature, is dropped.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Source: the [redemption dossier's verdict](../../deletions/agent-tools/webmcp-declarative-forms.md) — "redeemed — keep with rewrite (grade A)" — carried into the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md). The grade rests on a W3C CG explainer, a named Baseline feature with live Chrome WPT scores and a usage counter, first-party Chrome documentation with the identical attribute names, and named agent consumers (Brave Leo experimental support, Chrome 149 and Edge 150 origin trials). No tier change was recommended by the research and none is made here. Per the §4 weight law `weightForGrade('A', 'scored') = 1.0`; `scoreDisplayMode` stays `ternary`.

### Deviations

- **`defaultPriority` lands at `medium`, not `low`.** The dossier says "soften from 'high'" without naming a target. `medium` is the one adjacent step the evidence supports: a shipped-behind-origin-trial feature with a named consumer is worth doing, just not a top-line recommendation.
- **"Every form should be a tool" is kept as the pass bar.** The partial-coverage `warn` is inherited unchanged from the pre-rewrite audit. It is arguably too strong — a login or newsletter form is not obviously something a site wants agents driving — but narrowing which forms are in scope is a design question beyond this pass-condition rewrite, and the `warn` (not `fail`) keeps it advisory.
- **Adoption is ~0.0000027 of Chrome page loads**, so this audit still reports a finding on essentially every site scanned. That is a property of the signal's age, not of the check; the grade-A evidence is what the rubric prices, and the softened priority is what keeps it from dominating the recommendation list.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass; the grade comes from the adversarial redemption research below._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/webmcp-declarative-forms.md](../../deletions/agent-tools/webmcp-declarative-forms.md). Outcome: **redeemable**, grade A.


## Re-grade (2026-08-24): **A → B**, tier `scored`, weight 1.0 → 0.6

This audit reached the retirement shortlist under the bar "own dossier records
no known consumer **and** conflicts with a written position in `POLICY.md`". It
does not meet that bar, and it is not retired. Chrome's declarative-API page was
re-fetched on 2026-08-24: **live**, published 2026-05-18, documenting `toolname`,
`tooldescription`, `toolparamdescription` and `toolautosubmit`, and stating that
the browser interprets an annotated form as a tool and, when an agent calls it,
brings the form into focus and populates its fields. The consumer is real.

What the re-fetch also confirmed is that the page carries an **origin trial**
badge and says, verbatim:

> WebMCP is under active discussion and subject to change in the future.

`POLICY.md` reserves grade **A** for documented consumer behaviour or a ratified
standard with known consumers, and gives grade **B** to a draft standard with
meaningful adoption. An origin trial is the definition of the second: shipping
behind a registration, explicitly provisional, explicitly subject to change.
`weightForGrade('B', 'scored')` is **0.6**.

Nothing else moves. `scoreDisplayMode` stays `ternary`, the attribute set and
the `toolname`-required rule are unchanged, and a page with no form still
returns `notApplicable`. If the origin trial graduates to a shipped API, or the
W3C work reaches a ratified stage, this returns to a grade-A candidate.

**Sources:** [Declarative WebMCP API (Chrome for Developers, published 2026-05-18)](https://developer.chrome.com/docs/ai/webmcp/declarative-api) · [Retirement shortlist re-verification](../../RETIREMENT-SHORTLIST.md#re-verification-2026-08-24)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — rewritten (Plan 4, Task 10): `toolname` required to register a tool, `toolparamdescription`/`toolautosubmit` documented, dead `webmcp.link` docsUrl replaced with the Chrome declarative-API docs, `defaultPriority` softened `high` → `medium`, form-less pages `na` instead of `warn`. Grade **A**, tier `scored`, weight 1.0 — unchanged. `TODO(redeem)` header removed; entry dropped from REWORK-TODO.md.
- 2026-08-24 — re-graded A → B, weight 1.0 → 0.6. Chrome documents the browser reading the attributes, but the API is an origin trial and "subject to change". Not retired.
