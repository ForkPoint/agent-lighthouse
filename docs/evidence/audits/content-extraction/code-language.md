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

AI agents use language annotations on code blocks to apply the correct syntax understanding and provide accurate code explanations. Without them, agents must guess the programming language, which can lead to incorrect interpretations in AI-generated code answers.

## Code review findings (2026-08-20, 11-agent pass)

Recognizes exactly one convention — 'classList.includes('language-')' on the <code> element — and misses every other mainstream one. Shiki (the default highlighter for Astro, VitePress, Nextra, and Docusaurus v3) puts the language on the <pre> as data-language and leaves <code> classless; GitHub-flavored output uses 'lang-js'; Prism's documented markup allows the class on <pre> alone. So the best-instrumented docs sites in 2026 score 0/N and are told to fix something that is already correct. The substring match is also unanchored, so class="no-language-detected" counts as annotated. Finally the zero-code-block case warns rather than returning na, so a bakery's website is warned for having no code samples.

**Required fix:** Accept the union of real conventions: class matching /(^|\s)(language|lang)-[a-z0-9+#-]+/ on the <code> OR its parent <pre>, plus [data-language]/[data-lang] on either. Anchor the match so 'no-language-detected' does not count. Change the zero-code-block branch from warn() to notApplicable(). Filter the loop to applicablePageTypes pages.

**False-positive risks:**
- Shiki output (<pre class="shiki" data-language="ts"><code>) scores 0/N → hard fail on Astro/VitePress/Nextra/Docusaurus-v3 docs sites.
- GitHub-style 'lang-js' and Prism's <pre class="language-js"><code> are not matched → false fail.
- 'classList.includes('language-')' is an unanchored substring test: class="no-language-detected" or "multi-language-tabs" counts as annotated → false pass.
- Only 'pre code' is matched; highlighters that emit <div class="highlight"><pre> with no <code> (Rouge/Jekyll, Pygments) are invisible → 'No code blocks found' warn on a docs site full of code.
- Zero code blocks yields a warn, not na — every non-technical site carries a permanent unfixable warning.
- applicablePageTypes ['content'] gates the run but the loop covers all pages.

**Test gaps:**
- No Shiki fixture (data-language on <pre>) — the most-deployed modern highlighter is untested.
- No 'lang-js' fixture, no class-on-<pre> fixture.
- No 'no-language-detected' fixture proving the substring false pass.
- No <div class="highlight"><pre> (no <code>) fixture.
- No assertion that the no-code case should be na rather than warn.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An HTML-to-Markdown converter of the kind that feeds page text to LLMs emits a fenced code block whose info string names the language only when the `<code>` element carries a `language-*` class; without that class the fence is emitted unlabeled, and the language must be inferred from the code text itself.

**Grade: C** — the convention is explicitly described in the HTML Standard and is mechanically consumed by the Markdown converter behind common LLM-facing readers, but no vendor documents an AI agent reading it and no study measures an effect on answer quality, so the mechanism is plausible and unproven.

**Evidence:**
- WHATWG HTML Standard §4.5.15 (`code` element): "There is no formal way to indicate the language of computer code being marked up. Authors who wish to mark `code` elements with the language used, e.g. so that syntax highlighting scripts can use the right rules, can use the `class` attribute, e.g. by adding a class prefixed with "`language-`" to the element." The spec's own example is `<pre><code class="language-pascal">…</code></pre>` — the exact `pre > code` idiom the audit queries. Note the named consumer is "syntax highlighting scripts", not AI agents — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-code-element (verified 2026-08-21)
- Turndown, the widely used HTML→Markdown library, derives the fence language from precisely this class in its `fencedCodeBlock` rule: `const className = node.firstChild.getAttribute('class') || ''` then `const language = (className.match(/language-(\S+)/) || [null, ''])[1]` — https://raw.githubusercontent.com/mixmark-io/turndown/master/src/commonmark-rules.js (verified 2026-08-21)
- Jina Reader, an HTML→Markdown service built for LLM consumption, uses Turndown as its conversion engine (it exposes `x-md-*` headers to "fine-tune markdown output" via `src/dto/turndown-tweakable-options.ts`) and returns markdown/frontmatter/chunked output for language models — so the `language-*` class is a real, traceable input to at least one production agent-facing pipeline — https://github.com/jina-ai/reader (verified 2026-08-21)

**Counter-evidence:** No AI vendor documentation states that any agent reads code-block language classes, and no published study measures a change in AI answer quality attributable to them; the causal step from "fence is labeled" to "agent explains the code correctly" is untested, and modern LLMs identify programming languages from source text without an annotation. The convention is also not the only one in use — the HTML Standard itself concedes "there is no formal way", and Shiki's `data-language` on `<pre>`, GitHub-style `lang-*` and Prism's class-on-`<pre>` are all in live use, none of which Turndown's `language-` regex on `node.firstChild` matches. That weakens the practical reach of the one traceable consumer path as much as it weakens the audit's detector.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **C** (mechanism research pass); informative, unscored per the evidence policy.
