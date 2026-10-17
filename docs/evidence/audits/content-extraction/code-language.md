---
audit: content-extraction/code-language
category: content-extraction
source_file: packages/core/src/audits/content-extraction/code-language.ts
slug: code-language
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - whatwg-code-element
  - turndown-commonmark-rules
  - jina-reader-repo
---

# code-language (`6.10`)

> semantic-html · source `code-language.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI agents use language annotations on code blocks to apply the correct syntax understanding and provide accurate code explanations. Without them, agents must guess the programming language, which can lead to incorrect interpretations in AI-generated code answers.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An HTML-to-Markdown converter of the kind that feeds page text to LLMs emits a fenced code block whose info string names the language only when the `<code>` element carries a `language-*` class. Without that class the fence is emitted unlabeled, and the language must be inferred from the code text itself.

**Grade: C** — the convention is explicitly described in the HTML Standard, and mechanically consumed by the Markdown converter behind common LLM-facing readers. But no vendor documents an AI agent reading it, and no study measures an effect on answer quality. The mechanism is plausible and unproven.

**Evidence:**

- WHATWG HTML Standard §4.5.15 (`code` element): "There is no formal way to indicate the language of computer code being marked up. Authors who wish to mark `code` elements with the language used, e.g. so that syntax highlighting scripts can use the right rules, can use the `class` attribute, e.g. by adding a class prefixed with "`language-`" to the element." The spec's own example is `<pre><code class="language-pascal">…</code></pre>` — the exact `pre > code` idiom the audit queries. Note the named consumer is "syntax highlighting scripts", not AI agents — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-code-element (verified 2026-08-21)
- Turndown, the widely used HTML→Markdown library, derives the fence language from precisely this class in its `fencedCodeBlock` rule: `const className = node.firstChild.getAttribute('class') || ''` then `const language = (className.match(/language-(\S+)/) || [null, ''])[1]` — https://raw.githubusercontent.com/mixmark-io/turndown/master/src/commonmark-rules.js (verified 2026-08-21)
- Jina Reader, an HTML-to-Markdown service built for LLM consumption, uses Turndown as its conversion engine; it exposes `x-md-*` headers to "fine-tune markdown output" via `src/dto/turndown-tweakable-options.ts`. It returns markdown, frontmatter and chunked output for language models. The `language-*` class is therefore a real, traceable input to at least one production agent-facing pipeline — https://github.com/jina-ai/reader (verified 2026-08-21)

**Counter-evidence:** No AI vendor documentation states that any agent reads code-block language classes, and no published study measures a change in AI answer quality attributable to them. The causal step from "fence is labeled" to "agent explains the code correctly" is untested. Modern LLMs also identify programming languages from source text without an annotation. The convention is also not the only one in use. The HTML Standard itself concedes "there is no formal way". Shiki's `data-language` on `<pre>`, GitHub-style `lang-*` and Prism's class-on-`<pre>` are all in live use. Turndown's `language-` regex on `node.firstChild` matches none of them. That weakens the practical reach of the one traceable consumer path as much as it weakens the audit's detector.

## Implementation deviations

- The audit runs on article and general pages. That list keeps the old general-content population. It is not the final feature-based gate.
