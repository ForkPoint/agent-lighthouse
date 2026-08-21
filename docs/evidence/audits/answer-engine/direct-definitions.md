---
audit: answer-engine/direct-definitions
audit_id: "9.4"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/direct-definitions.ts
slug: direct-definitions
review_verdict: delete
severity: medium
evidence_grade: unrated
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# direct-definitions (`9.4`)

> answer-engine · source `direct-definitions.ts` · review verdict **delete** · evidence grade **unrated** · disposition: **proposed: redeem as scored (pending triage)**

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
