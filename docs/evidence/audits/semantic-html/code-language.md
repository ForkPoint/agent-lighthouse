---
audit: semantic-html/code-language
audit_id: "6.10"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/code-language.ts
slug: code-language
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# code-language (`6.10`)

> semantic-html · source `code-language.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
