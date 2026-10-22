---
audit: content-extraction/code-language
category: content-extraction
source_file: packages/core/src/audits/content-extraction/code-language.ts
slug: code-language
evidence_grade: C
disposition: "kept — feature scope corrected 2026-10-21"
reviewed: 2026-10-21
sources:
  - whatwg-code-element
  - turndown-commonmark-rules
  - jina-reader-repo
---

# code-language (`6.10`)

> semantic-html · source `code-language.ts` · evidence grade **C** · tier **informative** · weight **0**

## What it checks

The audit selects `<code>` elements inside `<pre>` across all sampled page types. Each selected element needs a complete, nonempty `language-*` class token to count as annotated. Inline code and plain `<pre>` text do not enter the denominator. No matching blocks returns `notApplicable`.

## Why it matters

Language classes give some HTML-to-Markdown converters a label to preserve in fenced code output. They do not prove better AI explanations. This check remains informative and contributes no score weight.

## Evidence (2026-08-21)

**Mechanism claim:** An HTML-to-Markdown converter of the kind that feeds page text to LLMs emits a fenced code block whose info string names the language only when the `<code>` element carries a `language-*` class. Without that class the fence is emitted unlabeled, and the language must be inferred from the code text itself.

**Grade: C** — the convention is explicitly described in the HTML Standard, and mechanically consumed by the Markdown converter behind common LLM-facing readers. But no vendor documents an AI agent reading it, and no study measures an effect on answer quality. The mechanism is plausible and unproven.

**Evidence:**

- WHATWG HTML Standard §4.5.15 (`code` element): "There is no formal way to indicate the language of computer code being marked up. Authors who wish to mark `code` elements with the language used, e.g. so that syntax highlighting scripts can use the right rules, can use the `class` attribute, e.g. by adding a class prefixed with "`language-`" to the element." The spec's own example is `<pre><code class="language-pascal">…</code></pre>` — the exact `pre > code` idiom the audit queries. Note the named consumer is "syntax highlighting scripts", not AI agents — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-code-element (verified 2026-08-21)
- Turndown, the widely used HTML→Markdown library, derives the fence language from precisely this class in its `fencedCodeBlock` rule: `const className = node.firstChild.getAttribute('class') || ''` then `const language = (className.match(/language-(\S+)/) || [null, ''])[1]` — https://raw.githubusercontent.com/mixmark-io/turndown/master/src/commonmark-rules.js (verified 2026-08-21)
- Jina Reader, an HTML-to-Markdown service built for LLM consumption, uses Turndown as its conversion engine; it exposes `x-md-*` headers to "fine-tune markdown output" via `src/dto/turndown-tweakable-options.ts`. It returns markdown, frontmatter and chunked output for language models. The `language-*` class is therefore a real, traceable input to at least one production agent-facing pipeline — https://github.com/jina-ai/reader (verified 2026-08-21)

**Counter-evidence:** No AI vendor documentation states that any agent reads code-block language classes, and no published study measures a change in AI answer quality attributable to them. The causal step from "fence is labeled" to "agent explains the code correctly" is untested. Modern LLMs also identify programming languages from source text without an annotation. The convention is also not the only one in use. The HTML Standard itself concedes "there is no formal way". Shiki's `data-language` on `<pre>`, GitHub-style `lang-*` and Prism's class-on-`<pre>` are all in live use. Turndown's `language-` regex on `node.firstChild` matches none of them. That weakens the practical reach of the one traceable consumer path as much as it weakens the audit's detector.

## How it scores

All selected blocks annotated: pass. More than half, but not all: warn. Half or fewer: fail. No selected blocks: not applicable. These are informative verdicts with weight 0; the thresholds do not measure AI answer quality.

## Implementation deviations

- Hidden code elements do not contribute. Each `<pre>` counts as one block, assessed by its first visible `<code>`. Turndown fences a `<pre>` once and labels the fence from that element, so further `<code>` children do not change the result.

- Common scope replaces the article/general list. Code-block presence selects the population. Runner tests cover all five page types, both declared and detected provenance, absent code and mixed readable/unread samples.
- Empty `language-` tokens and embedded strings such as `not-language-python` no longer count. The audit checks the complete class convention rather than copying Turndown's permissive substring regex.
- The detector deliberately checks only classes on the code element. Classes on `<pre>`, `lang-*` and `data-language` remain outside this convention. Tests pin these boundaries; a finding does not mean those annotations fail in their own consumers.
- The existing `pre code` descendant selector remains broader than Turndown's first-child requirement. This is a convention check, not a conversion simulation. It does not validate language identifiers or compare the claimed language with the code.

## Deferred

- Add other annotation conventions only with their consumer evidence and explicit output semantics. No new scored consumer path is established here.

## Review history

2026-10-21: Rechecked [Turndown's fenced-code rule](https://raw.githubusercontent.com/mixmark-io/turndown/master/src/commonmark-rules.js) (verified 2026-10-21). It reads the class on the first code child when fenced output is enabled. It requires a nonempty suffix to emit a language label. This supports the absence and empty-token corrections without changing the grade or tier.
