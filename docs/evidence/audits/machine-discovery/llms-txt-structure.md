---
audit: machine-discovery/llms-txt-structure
audit_id: "1.2, 1.3"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-structure.ts
slug: llms-txt-structure
review_verdict: merge
severity: low
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 4) — informative, weight 0"
reviewed: 2026-08-22
---

# llms-txt-structure (`1.2`, `1.3`)

> machine-discovery · source `llms-txt-structure.ts` · merges llms-txt-blockquote (1.2) + llms-txt-sections (1.3) · evidence grade **C** · tier **informative** (weight 0)

## Claimed mechanism (falsifiable)

An agent that fetches `/llms.txt` parses the blockquote under the H1 as the site summary and the H2 headings as the addressable sections of the link list, so a file carrying both can be consumed selectively — read the summary, pick a section — instead of end to end.

The claim is real but unproven at the consumer end: the format's reference parser exposes exactly these two fields, and no vendor documents an agent behaving differently when either is absent. Hence grade C and tier `informative` — the audit reports the shape of the file and never moves a score.

## What it checks

One root file, two structural elements, fenced code blocks excluded from both:

| Element | Detected as |
| :--- | :--- |
| Blockquote summary | a line starting with `>` among the first 3 non-blank lines after the H1 |
| H2 sections | lines matching `##` + non-hash + content, outside fenced blocks |

Result semantics:

| State | Result |
| :--- | :--- |
| both elements present | `pass` |
| exactly one missing | `warn`, priority `low` |
| both missing | `fail`, priority `low` |
| `/llms.txt` absent or non-200 | `na` — that is `llms-txt-exists`' signal |
| 200 with no `#` heading at all (soft-404 / HTML) | `na` — the body is not a markdown llms.txt |

`scoreDisplayMode: 'informative'` with `weight: 0` keeps every outcome out of the category score, the readiness vitals and the top-fails list.

## Why the two were merged

The approved v2 map rows for 1.2 and 1.3 both target one combined structure audit ("§5: llms-txt-blockquote + llms-txt-sections → one llms.txt structure audit"). Both were formatting sub-clauses of the same optional file, each scored as a full audit, and each levied its own `critical` failure when the file was simply absent — three critical entries for one missing optional file.

The merge is also where each source review's required fixes land:

- **Blockquote window.** v1 scanned the *entire* remainder of the file, so a footnote at the bottom of a 400-line llms.txt counted as the summary. Now only the first 3 non-blank lines after the H1 qualify.
- **`>` without a space.** v1 required a literal `'> '`; the common (and valid CommonMark) `>Summary` was reported missing.
- **One H1 definition.** v1 required `'# '` while `llms-txt-exists` accepts a bare `#`, so one file could pass 1.1 and fail 1.2 with "No H1 heading found". Both now accept `#Site`.
- **Fenced blocks.** A file that documents llms.txt syntax scored its own `##` examples as real sections and its quoted `>` example as a summary. Fences are stripped before either search.
- **Absent file ⇒ `na`.** v1 returned `fail` at priority `critical` from both audits when `/llms.txt` was missing, asserting a malformed file where there was none.
- **Priority.** The spec makes both elements optional ("zero or more" sections; the H1 is "the only required section"), so a missing element can no longer be reported above `low`.

## Scoring

**C — the strongest proven path for the merged signal, unchanged from both sources.**

1.2 and 1.3 were graded C independently on 2026-08-21 and the merged signal inherits that grade: it is the same file, the same optional elements and the same single real consumer (the reference parser and its `llms_txt2ctx` CLI). Nothing in either dossier is stronger evidence for the *merged* claim than for its own half, so the merge raises nothing. `weightForGrade('C', 'informative') === 0`, and grade C would carry weight 0 even at tier `scored` — the tier records that this audit also may not appear as a scored failure.

The grade is additionally capped by that of `llms-txt-exists` (1.1): a formatting sub-clause of a file cannot outrank the file's own evidence.

## Evidence

### Blockquote summary (from 1.2, grade C)

**Evidence:**
- The llms.txt specification lists the blockquote as an element of the format — "A blockquote with a short summary of the project, containing key information" — while stating the H1 "is the only required section" — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation parses the blockquote into a named `summary` field: `summ_pat` = `(?:^>\s*(?P<summary>.+?$)$)?`, returned alongside `title`, `info` and `sections` — a real, inspectable consumer — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- That parser ships as a published package with the `llms_txt2ctx` CLI that turns the file into LLM context — https://pypi.org/project/llms-txt/ (verified 2026-08-21)

**Counter-evidence:** Chrome's own Lighthouse llms.txt audit validates only an H1, one markdown link and a 50-character minimum — it does not check for a blockquote (https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js, verified 2026-08-21). Google states Search "ignores" llms.txt entirely (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21).

### H2 sections (from 1.3, grade C)

**Evidence:**
- The spec defines "Zero or more markdown sections delimited by H2 headers, containing 'file lists'", and attaches behaviour to one heading: the "'Optional' section is used, by convention, for secondary information: links an agent can skip when a shorter context is needed" — the only agent-visible semantics the format assigns to a heading — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation returns `sections` as a dict mapping section names to their parsed link lists, so an H2 heading is a real addressable key — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- Chrome ships an agentic-browsing Lighthouse audit for llms.txt, giving the format vendor-tool recognition — https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt (verified 2026-08-21)

**Counter-evidence:** "Zero or more" makes a section-free llms.txt fully conformant, so the v1 "at least one `##`" bar was stricter than the standard it cited. No source claims a measured difference in agent behaviour between a sectioned and an unsectioned file. Two months of measured server logs recorded only 37 of ~770 llms.txt/llms-full.txt fetches coming from named AI assistants (https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured, verified 2026-08-21). Neither OpenAI's (https://developers.openai.com/api/docs/bots) nor Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mentions llms.txt at all (both verified 2026-08-21).

## Absorbed evidence — source dossiers

Both absorbed dossiers are kept verbatim as the record of why each half moved:

- [llms-txt-blockquote (1.2)](../../merged/machine-discovery/llms-txt-blockquote.md) — grade C
- [llms-txt-sections (1.3)](../../merged/machine-discovery/llms-txt-sections.md) — grade C

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — dispositions approved: 1.2 and 1.3 merge into one llms.txt structure audit.
- 2026-08-22 — merged into this audit (Plan 4, Task 4); registry 174 → 173.
