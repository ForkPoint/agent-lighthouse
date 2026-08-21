---
audit: answer-engine/direct-definitions
audit_id: "9.4"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/direct-definitions.ts
slug: direct-definitions
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# direct-definitions (`9.4`)

> answer-engine · source `direct-definitions.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

AI engines extract term-definition pairs to generate direct-answer snippets for "what is X?" queries. Use <dfn>, <dl>, or bold-colon patterns to mark up key terms.

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
- No prose-definition page (the important false NEGATIVE: 'Unified content preparation is the process of...' with no markup fails).
- No test proving /contact-style pages reach this audit through isArticleContentPage.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** Marking a term and its definition with `<dfn>` or `<dl>`/`<dt>`/`<dd>` exposes explicit term/definition roles in the accessibility tree and keeps the pairing intact through extraction, so an answer engine can return the definition for a "what is X?" query without inferring it from surrounding prose.

**Grade: C** — the markup is ratified and carries a spec-defined term/definition role mapping, but no vendor doc, agent harness or study shows any consumer acting on that mapping, and the audit's third detector branch (bold-colon) is a typographic convention with no spec basis at all.

**Evidence:**
- WHATWG HTML defines the element precisely: `dfn` "represents the defining instance of a term", and "The paragraph, description list group, or section that is the nearest ancestor of the `dfn` element must also contain the definition(s) for the term given by the `dfn` element" — the pairing is a conformance requirement, not a convention — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-dfn-element (verified 2026-08-21)
- HTML-AAM maps the markup to first-class roles in the tree agents read: `dfn` → `term`, `dt` → `term`, `dd` → `definition`, `dl` → `list` — https://www.w3.org/TR/html-aam-1.0/ (verified 2026-08-21)
- Extraction pipelines preserve structural markup rather than flattening it: trafilatura's `include_formatting` keeps "structural elements related to formatting (kept in XML, rendered as markdown for text formats)" — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- Structured formats extract better than prose in general: GEO-SFE reports "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose" — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** No vendor documentation and no agent harness documents acting on `role="term"` or `role="definition"`; this repository's own semantic-html research records that "Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping" (`docs/evidence/audits/semantic-html/definition-elements.md`). The markdown conversion path that the mechanism relies on actually weakens it: CommonMark has no definition-list syntax, so a `<dl>` passing through a markdown pipeline such as Cloudflare's Markdown for Agents (https://blog.cloudflare.com/markdown-for-agents/) or trafilatura's markdown output flattens to ordinary lines and loses the term/definition distinction that HTML-AAM preserves. GEO-SFE isolates lists and tables, never definition markup. Google states there is no special markup needed and "You don't need to write in a specific way just for generative AI search" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), and C-SEO Bench found "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). The `<strong>Term:</strong> …` branch has no spec, no role mapping and no consumer — graded on its own it is D. All URLs verified 2026-08-21.
