---
audit: answer-readiness/direct-definitions
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/direct-definitions.ts
slug: direct-definitions
evidence_grade: C
disposition: "kept — rewritten to an intent-gated, language-neutral check 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
sources:
  - whatwg-html-dfn
  - w3c-html-aam
  - trafilatura-corefunctions
  - geo-sfe-structural-arxiv
  - cloudflare-markdown-for-agents
  - google-ai-optimization-mythbusting
  - cseo-bench-arxiv
---

# direct-definitions (`9.4`)

> answer-readiness · source `direct-definitions.ts` · evidence grade **C** · tier **informative** (weight 0) · rewritten from a three-branch markup sniff to an intent-gated, language-neutral coverage report — see below

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

HTML-AAM maps `<dfn>` and `<dt>`/`<dd>` to the `term` and `definition` roles, and WHATWG requires the definition to sit alongside the term it defines, so the pairing survives extraction intact. No consumer is documented as acting on that mapping and prose definitions read fine, so this is reported as upside on pages that already answer a definitional question — never as a defect.

_(The pre-rewrite audit also counted a `<strong>Term:</strong>` bold-colon pattern. That branch is graded D on its own and is deleted; see the rewrite section.)_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Marking a term and its definition with `<dfn>`, or with `<dl>`, `<dt>` and `<dd>`, exposes explicit term and definition roles in the accessibility tree. It also keeps the pairing intact through extraction. An answer engine can then return the definition for a "what is X?" query without inferring it from surrounding prose.

**Grade: C** — the markup is ratified, and carries a spec-defined term-to-definition role mapping. But no vendor doc, agent harness or study shows any consumer acting on that mapping. The audit's third detector branch, bold-colon, is a typographic convention with no spec basis at all.

**Evidence:**

- WHATWG HTML defines the element precisely. `dfn` "represents the defining instance of a term". The spec adds: "The paragraph, description list group, or section that is the nearest ancestor of the `dfn` element must also contain the definition(s) for the term given by the `dfn` element". The pairing is therefore a conformance requirement, not a convention — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-dfn-element (verified 2026-08-21)
- HTML-AAM maps the markup to first-class roles in the tree agents read: `dfn` → `term`, `dt` → `term`, `dd` → `definition`, `dl` → `list` — https://www.w3.org/TR/html-aam-1.0/ (verified 2026-08-21)
- Extraction pipelines preserve structural markup rather than flattening it: trafilatura's `include_formatting` keeps "structural elements related to formatting (kept in XML, rendered as markdown for text formats)" — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- Structured formats extract better than prose in general: GEO-SFE reports "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose" — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** No vendor documentation and no agent harness documents acting on `role="term"` or `role="definition"`; this repository's own semantic-html research records that "Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping" (`docs/evidence/audits/semantic-html/definition-elements.md`). The markdown conversion path that the mechanism relies on actually weakens it. CommonMark has no definition-list syntax. A `<dl>` passing through a markdown pipeline — Cloudflare's Markdown for Agents (https://blog.cloudflare.com/markdown-for-agents/), or trafilatura's markdown output — flattens to ordinary lines, and loses the term-to-definition distinction that HTML-AAM preserves. GEO-SFE isolates lists and tables, never definition markup. Google states that no special markup is needed, and that "You don't need to write in a specific way just for generative AI search" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). C-SEO Bench found that "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). The `<strong>Term:</strong> …` branch has no spec, no role mapping and no consumer — graded on its own it is D. All URLs verified 2026-08-21.

## Implementation deviations

- The gate is definitional intent, not the article filter. A page qualifies on a `<dfn>`, `<dl>` or `<dt>`, or on a title or heading that asks "what is X?" or names a glossary. A crawl with no such page is `notApplicable`.
- Lexical patterns come from the primary subtag of `<html lang>`, with English as the fallback. They cover `en`, `es`, `fr`, `de`, `pt`, `it`, `nl`, `ru`, `ja`, `zh` and `ko`.
- JavaScript word boundaries are ASCII-only. The Portuguese and Italian rules therefore end on the accented vowel with no trailing `\b`.
- A `<dd>` is substantive at six words or 20 non-whitespace characters. The character measure makes CJK definition lists count.
- The audit never fails. Prose definitions and partial markup warn, because no consumer acts on the term and definition roles.
- The `<strong>Term:</strong>` bold-colon pattern is not counted. Graded on its own it is D.
- The page-type list (`general`, `article`) keeps the old general-content population. It is a holding scope, not the final feature gate.
- Grade C puts the audit in the `informative` tier at weight 0. A move to `scored` needs a documented consumer of the term and definition roles.
