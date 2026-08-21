---
audit: machine-discovery/llms-txt-blockquote
audit_id: "1.2"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-blockquote.ts
slug: llms-txt-blockquote
review_verdict: merge
severity: medium
evidence_grade: C
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# llms-txt-blockquote (`1.2`)

> content-discoverability · source `llms-txt-blockquote.ts` · review verdict **merge** · evidence grade **C** · disposition: **merge (approved 2026-08-21)**

## What it checks

The blockquote summary gives AI agents a one-sentence overview of your site without reading further.

## Code review findings (2026-08-20, 11-agent pass)

Grades one cosmetic property of llms.txt — whether a '> ' line appears somewhere after the H1. This is a formatting sub-clause of the same unproven spec 1.1 checks, scored as its own full-weight audit, and its failure messaging is actively wrong when llms.txt is absent-but-200. Fold into a single 'llms.txt is well-formed' audit together with 1.3.

**Required fix:** Merge into a combined llms.txt structure audit with 1.3. Constrain the blockquote search to the first non-blank line(s) following the H1, accept '>' without a trailing space, share one H1 definition with 1.1, and return notApplicable() (not a critical fail) when llms.txt is absent.

**False-positive risks:**
- `afterH1.some((l) => l.trimStart().startsWith('> '))` scans the ENTIRE remainder of the file, not the lines adjacent to the H1. A blockquote used as a footnote at the bottom of a 400-line llms.txt passes as a 'summary'.
- Requires a literal `'> '` with trailing space — the extremely common `>Summary` (no space, still valid CommonMark) is reported as missing.
- `lines.findIndex((l) => l.trimStart().startsWith('# '))` requires '# ' with a space, while audit 1.1 accepts bare '#'. The two audits disagree about what an H1 is, so one file can pass 1.1 and fail 1.2 with 'No H1 heading found'.
- When /llms.txt returns 200 with an HTML soft-404, no `# ` line exists, so the audit reports 'No H1 heading found in llms.txt' — asserting the file exists and is malformed when it does not exist at all.
- Indented blockquotes inside fenced code blocks count as the summary.

**Test gaps:**
- Blockquote appearing far below the H1 (should not count as a summary but currently does)
- '>Summary' without a space
- H1 written as '#Site' — passes 1.1, fails here
- llms.txt served as an HTML soft-404
- Blockquote inside a fenced code block

**Overlaps with:** `1.1`, `1.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** An agent that fetches `/llms.txt` parses the blockquote line following the H1 as the site summary and uses it to decide what else to retrieve; with the blockquote absent, the agent retrieves more of the site or answers less accurately.

**Grade: C** — the blockquote is a spec-defined (but optional) element that the format's reference parser extracts as a `summary` field, yet no vendor documents any named agent consuming it, and Google's own llms.txt tooling deliberately does not check for it.

**Evidence:**
- The llms.txt specification lists the blockquote as an element of the format — "A blockquote with a short summary of the project, containing key information" — while stating that the H1 "is the only required section" — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation parses the blockquote into a named `summary` field: `summ_pat` = `(?:^>\s*(?P<summary>.+?$)$)?`, returned alongside `title`, `info` and `sections` — a real, inspectable consumer of the field — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- That parser ships as a published package with the `llms_txt2ctx` CLI that turns the file into LLM context — https://pypi.org/project/llms-txt/ (verified 2026-08-21)
- Chrome ships an "agentic browsing" Lighthouse audit for llms.txt, whose stated rationale is that without the file "agents may spend more time crawling the site to understand its high-level structure and primary content" — https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt (verified 2026-08-21)

**Counter-evidence:** Google states "You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search (including its generative AI capabilities)... Doing so will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Chrome's own Lighthouse llms.txt audit validates only an H1 (`/^\s*#\s+.+/m`), the presence of at least one markdown link (`/\[.+\]\(.+\)/`) and a minimum length of 50 characters — it does not check for a blockquote (https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js, verified 2026-08-21). Two months of measured server logs recorded ~660 `/llms.txt` fetches of which only 37 came from named AI assistants (https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured, verified 2026-08-21). No crawler documentation from OpenAI (https://developers.openai.com/api/docs/bots) or Perplexity (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) mentions llms.txt at all; both document robots.txt only (both verified 2026-08-21). The grade is therefore capped by that of `1.1` — a formatting sub-clause of a file cannot outrank the file's own evidence.
