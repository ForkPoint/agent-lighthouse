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

HTML-AAM maps `<dfn>` and `<dt>`/`<dd>` to the `term` and `definition` roles, and WHATWG requires the definition to sit alongside the term it defines, so the pairing survives extraction intact. No consumer is documented as acting on that mapping and prose definitions read fine, so this is reported as upside on pages that already answer a definitional question — never as a defect.

_(The pre-rewrite audit also counted a `<strong>Term:</strong>` bold-colon pattern. That branch is graded D on its own and is deleted; see the rewrite section.)_

## Code review findings (2026-08-20, 11-agent pass)

Looks for <dfn>, a <dl> with a ≥6-word <dd>, or a <strong>/<b> label ending in ':' followed by ≥6 words. The premise — that AI engines need explicit definition MARKUP to extract term-definition pairs — is unsubstantiated folklore: LLM retrieval reads prose definitions perfectly well, and no documented crawler or answer engine weights <dfn>. Worse, the implementation reduces to 'does any article page contain a bolded label followed by a sentence', which every blog post with '<strong>Note:</strong> ...' satisfies. It rewards markup nobody consumes and fails prose-based definitions, which is guidance in the wrong direction.

**Required fix:** Delete. If the maintainer wants to keep a definition signal, the only defensible version is DefinedTerm/DefinedTermSet JSON-LD (a real, consumed vocabulary) and it belongs in the structured-data category, not here as an HTML-markup fashion check.

**False-positive risks:**
- Trivial universal pass via the bold-colon branch: `if (!label.endsWith(':')) return;` then `wordCount(after) >= 6`. Any '<strong>Note:</strong> this applies to all plans as of March', '<strong>Tip:</strong> ...', '<strong>Warning:</strong> ...', '<strong>Ingredients:</strong> ...' passes and is reported as 'bold-colon definitions'. This is not a definition and the user is told their definition markup is in good shape.
- Parent-text slicing is fragile: `parentText.slice(parentText.indexOf(label) + label.length)` uses the FIRST occurrence of the label string in the parent. When the same label text appears twice in the parent, or when the <strong> is deep inside a list item whose parent text concatenates several siblings, `after` is the wrong text — it can pick up an adjacent item's words and cross the ≥6 threshold spuriously.
- Sibling text is counted as the definition: for `<li><strong>Colors:</strong></li><li>red green blue black white grey</li>` inside a shared parent, the concatenated parent text pushes `after` over 6 words even though nothing follows the colon.
- English/Latin-punctuation only in effect: full-width colon '：' (Chinese/Japanese) fails `endsWith(':')`, so CJK spec/definition lists never count. Word counting via `split(/\s+/)` again reads CJK sentences as 1 word, so a legitimate CJK <dd> definition never reaches the 6-word threshold.
- Scoped through the leaky `isArticleContentPage`, so a /contact or /privacy page can be the sole 'article' and produce a site-level fail for lacking definitions.
- Direction inversion: a genuinely well-written glossary using prose ('An X is a Y that does Z.') FAILS, while a spec sheet with a bold label passes. The audit measures markup fashion, not extractability.
- SPA/CSR: definition lists rendered client-side are invisible → false fail.

**Test gaps:**
- No test with '<strong>Note:</strong> ...' or '<strong>Tip:</strong> ...' — the dominant real-world false pass.
- No test where the same label string occurs twice in the parent, or where <strong> and its 'definition' are in different sibling elements.
- No CJK full-width colon or CJK <dd>.
- No prose-definition page (the important false negative: 'Unified content preparation is the process of...' with no markup fails).
- No test proving /contact-style pages reach this audit through isArticleContentPage.

**Overlaps with:** _none_

## The intent-gated rewrite (Plan 4, Task 16, 2026-08-22)

**Old pass condition:** any page passing the leaky `isArticleContentPage` filter contains a `<dfn>`, **or** a `<dl>` with a ≥6-word `<dd>`, **or** a `<strong>`/`<b>` whose text ends in `:` followed by ≥6 words. Everything else **failed**.

**New pass condition:** every page that shows definitional intent pairs its terms with `<dfn>` or a `<dl>` carrying a substantive `<dd>`. Partial or prose-only coverage warns; a crawl with no definitional page is `notApplicable`. The audit can no longer fail anything.

### The bold-colon branch is deleted

Graded **D** on its own in the section below — "no spec, no role mapping and no consumer". In practice it was the whole audit: `if (!label.endsWith(':')) return;` then `wordCount(after) >= 6` passes on `<strong>Note:</strong> this applies to all plans as of March`, on `Tip:`, on `Warning:`, on `Ingredients:`. It also sliced the definition out of `parentText` at the **first** occurrence of the label, so a repeated label, or a `<strong>` inside a list item whose parent text concatenates siblings, attributed a neighbouring item's words to the term. Both the branch and its parent-text slicing are gone, along with every mention of the pattern in the guidance copy — pinned by a regression test.

### Definitional intent replaces the leaky article gate

`isArticleContentPage` let a `/contact` or `/privacy` page be the sole "article" and produce a site-level verdict about definitions. The gate is now the question the audit is actually about — does this page define something:

- **Structural**, and therefore language-neutral: the page carries a `<dfn>` or a `<dl>`/`<dt>`. That markup *is* the page declaring that it defines a term, in any language.
- **Lexical**, per detected language: the title or a heading asks "what is X?", or indexes a glossary or terminology. Read from the primary subtag of `<html lang>`, with English as the fallback.

A crawl where no page passes either test is `na`, which is the "notApplicable when page has no definitional intent" the required rework asks for.

### Language neutrality

The required rework asks for "language-neutral structural signals … and first-sentence definition patterns per detected language", and both halves landed:

- **Substantiveness is measured two ways**: ≥6 whitespace-separated words **or** ≥20 non-whitespace characters. The second is what makes CJK work — `split(/\s+/)` reads a whole Japanese sentence as one word, so the old ≥6-word threshold was unreachable for any CJK `<dd>`, and CJK definition lists could never count. The old full-width-colon problem disappears with the bold-colon branch itself.
- **Intent and prose-copula patterns** are tabled for `en`, `es`, `fr`, `de`, `pt`, `it`, `nl`, `ru`, `ja`, `zh` and `ko`. One implementation note worth keeping: JavaScript word boundaries are ASCII-only, so `/é\b/` never matches — the Portuguese and Italian rules end on the accented vowel without a trailing `\b`.

### The direction inversion is corrected

The code review's sharpest finding was that a genuinely well-written prose glossary — "An X is a Y that does Z" — **failed**, while a spec sheet with a bold label passed. Prose definitions are now detected in the opening paragraphs via the language's copula pattern and reported as *prose coverage*, and the strongest verdict the audit can reach is `warn`. That ceiling is deliberate and follows the counter-evidence: no vendor or harness documents acting on `role="term"`/`role="definition"`; CommonMark has no definition-list syntax, so a `<dl>` flattens in any markdown-for-agents pipeline; Google states "You don't need to write in a specific way just for generative AI search"; and C-SEO Bench found most C-SEO interventions ineffective or harmful. Failing a page whose definitions are perfectly readable prose would repeat the error the rewrite exists to remove.

### Grade and tier decision: **C**, tier `informative`, weight 0 — target tier `scored` not reachable

The REWORK-TODO row proposed `scored`. It cannot land: the [graded evidence below](#evidence-2026-08-21) assigns **C**, and under the §4 weight law `weightForGrade('C', 'scored') = 0`, while `sunset.test.ts` enforces `tier !== 'scored' ⟺ weight === 0`. A grade-C audit in the `scored` tier is therefore not a registrable state, and `informative` is where the grade puts it — the same resolution recorded for `openapi-link`, where a proposed `scored` target lost to the tier the evidence named. Nothing in the required rework depends on the tier: it asks for a better detector and an `na` path, both of which landed. `scoreDisplayMode` stays `informative`; `defaultPriority` drops `medium` → `low`, since the audit now reports upside rather than a defect.

Re-grading to A or B would need a documented consumer acting on the term/definition roles. The dossier records that none exists, and this project's own semantic-html research says the same of `<dl>`/`<dt>`/`<dd>`.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-22 — user approved the pending-triage redeem; required rework executed (Plan 4, Task 16): bold-colon branch deleted, definitional-intent gate replaces `isArticleContentPage`, substantiveness measured character-wise as well as word-wise so CJK counts, per-language intent and prose-copula patterns for 11 languages, prose definitions reported rather than failed, `na` when no page has definitional intent, and the audit can no longer fail. Grade C, tier `informative`, weight 0 — the row's proposed `scored` target is unreachable for a grade-C audit under the §4 weight law and the registry invariant; rationale in the rewrite section. `defaultPriority` `medium` → `low`. `TODO(redeem)` marker removed from the source file.

## Evidence (2026-08-21)

**Mechanism claim:** Marking a term and its definition with `<dfn>` or `<dl>`/`<dt>`/`<dd>` exposes explicit term/definition roles in the accessibility tree and keeps the pairing intact through extraction, so an answer engine can return the definition for a "what is X?" query without inferring it from surrounding prose.

**Grade: C** — the markup is ratified and carries a spec-defined term/definition role mapping, but no vendor doc, agent harness or study shows any consumer acting on that mapping, and the audit's third detector branch (bold-colon) is a typographic convention with no spec basis at all.

**Evidence:**
- WHATWG HTML defines the element precisely: `dfn` "represents the defining instance of a term", and "The paragraph, description list group, or section that is the nearest ancestor of the `dfn` element must also contain the definition(s) for the term given by the `dfn` element" — the pairing is a conformance requirement, not a convention — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-dfn-element (verified 2026-08-21)
- HTML-AAM maps the markup to first-class roles in the tree agents read: `dfn` → `term`, `dt` → `term`, `dd` → `definition`, `dl` → `list` — https://www.w3.org/TR/html-aam-1.0/ (verified 2026-08-21)
- Extraction pipelines preserve structural markup rather than flattening it: trafilatura's `include_formatting` keeps "structural elements related to formatting (kept in XML, rendered as markdown for text formats)" — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- Structured formats extract better than prose in general: GEO-SFE reports "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose" — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** No vendor documentation and no agent harness documents acting on `role="term"` or `role="definition"`; this repository's own semantic-html research records that "Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping" (`docs/evidence/audits/semantic-html/definition-elements.md`). The markdown conversion path that the mechanism relies on actually weakens it: CommonMark has no definition-list syntax, so a `<dl>` passing through a markdown pipeline such as Cloudflare's Markdown for Agents (https://blog.cloudflare.com/markdown-for-agents/) or trafilatura's markdown output flattens to ordinary lines and loses the term/definition distinction that HTML-AAM preserves. GEO-SFE isolates lists and tables, never definition markup. Google states there is no special markup needed and "You don't need to write in a specific way just for generative AI search" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), and C-SEO Bench found "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). The `<strong>Term:</strong> …` branch has no spec, no role mapping and no consumer — graded on its own it is D. All URLs verified 2026-08-21.
