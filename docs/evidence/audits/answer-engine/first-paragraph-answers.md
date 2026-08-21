---
audit: answer-engine/first-paragraph-answers
audit_id: "9.3"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/first-paragraph-answers.ts
slug: first-paragraph-answers
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# first-paragraph-answers (`9.3`)

> answer-engine · source `first-paragraph-answers.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI search engines score the first paragraph highest for extractive QA. Preamble text like "In this article" or "Welcome" wastes this prime position, causing agents to extract low-value content as your page\'s representative answer.

## Code review findings (2026-08-20, 11-agent pass)

Picks the first paragraph of ≥15 words containing a sentence terminator on the first article page, then fails it if it matches one of five English 'weak opener' regexes. Passing means only 'the opening paragraph does not begin with one of five English phrases' — which is nearly always true — while the paragraph-selection heuristic hard-fails entire writing systems. Both the pass and the fail are close to uninformative, and the fail text ('No substantive opening paragraph found') actively slanders pages that are full of prose.

**Required fix:** Replace the ASCII sentence heuristic with a script-aware one: segment with `Intl.Segmenter` (or accept 。！？…؟ terminators and use grapheme/character length ≥ 60 for space-less scripts) and gate the whole audit on the page `lang`, returning `na` for languages without a WEAK_OPENERS set instead of passing them silently. Restrict paragraph selection to <article>/<main> content, skipping banner/consent/promo containers. Tighten `isArticleContentPage` to real article signals so /contact cannot supply the verdict. Downgrade the vacuous pass: report it as informative rather than as a scored 'direct, declarative answer' claim, or add a positive test (first paragraph shares ≥2 content terms with the H1/title) instead of only testing for absence of filler.

**False-positive risks:**
- CJK hard fail: the substantive-paragraph filter requires `wordCount >= 15` from `t.split(/\s+/)` AND `/[a-z][.!?](\s|$|["'’”)])/`. Chinese/Japanese/Thai text has no spaces (wordCount 1) and terminates sentences with 。/！/？, and contains no ASCII [a-z]. Every such page returns 'No substantive opening paragraph found in the main content area' as a HIGH-priority fail, regardless of content.
- Same failure for non-Latin scripts generally: Cyrillic, Greek, Hebrew, Arabic prose never satisfies `[a-z]` before the terminator, so the sentence test can only match if a stray Latin word happens to precede a period.
- Legitimate English openers are misfiled too: a paragraph ending in an abbreviation, a number, or a closing tag boundary ('...costs $19.99.') satisfies the test, but one ending '...see Fig. 2' or a paragraph whose only terminator follows a digit does not.
- WEAK_OPENERS is English-only: the equivalent German 'In diesem Artikel', Spanish 'En este artículo', French 'Dans cet article' pass as 'a direct, declarative answer'. The audit is therefore lenient on exactly the sites its detection breaks on.
- Self-contradiction with 9.2: `/^(what|how|why|...)\b.*\?$/i` fails a first paragraph that is a question, while 9.2 rewards question-formatted headings. A page opening with 'What is X? It is Y...' — the exact pattern 9.1/9.2 promote — is penalized here only if the paragraph ends with '?'.
- Single-page, first-match verdict: `ctx.pages.find(isArticleContentPage)` takes the FIRST fallback-typed page, which per the category note may be /contact or /privacy-policy. The site-level 'first paragraph' grade can come from a legal page.
- Global chrome leaks in when <main> is absent: `const container = mainEl.length ? mainEl : $('body')` then `container.find('p')` in source order — a cookie-consent paragraph or promo banner of ≥15 words is selected as 'the first paragraph' on any page lacking <main>.
- SPA/CSR: no server-rendered prose → high-priority fail claiming an editorial defect that is actually a rendering defect.
- The pass semantics are vacuous: absence of 5 regexes is treated as evidence the paragraph 'appears to be a direct, declarative answer'. A page opening with 'Our company was founded in 1998 by two friends in a garage.' passes as a direct answer to the page's primary question.

**Test gaps:**
- No CJK / Cyrillic / Arabic page — the highest-impact false fail is completely untested.
- No non-English weak opener ('In diesem Artikel...') showing the lenient direction.
- No page lacking <main> where a cookie banner or promo paragraph is selected.
- No test of a first paragraph that is a question followed by its answer (the 9.2-recommended pattern).
- No multi-page context showing that /contact can supply the site-level verdict.
- No empty-SPA-shell test.
- The tests only ever feed the ideal paragraph or the exact literal 'In this article we explore...' string the regex was written against.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
