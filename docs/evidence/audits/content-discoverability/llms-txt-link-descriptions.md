---
audit: content-discoverability/llms-txt-link-descriptions
audit_id: "1.4"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/llms-txt-link-descriptions.ts
slug: llms-txt-link-descriptions
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# llms-txt-link-descriptions (`1.4`)

> content-discoverability · source `llms-txt-link-descriptions.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Link descriptions help AI agents understand what each page covers without visiting it, reducing unnecessary crawling.

## Code review findings (2026-08-20, 11-agent pass)

Measures the fraction of llms.txt links carrying a ': description'. The idea is sound, but it inherits `extractMarkdownLinks()`'s hard rejection of relative URLs, so a spec-conformant llms.txt written exactly like this audit's own `guidance.code` sample scores zero links and warns 'llms.txt contains no markdown links'. That is the framework contradicting its own printed advice.

**Required fix:** In `parser.ts::extractMarkdownLinks`, resolve relative URLs against a passed-in base instead of dropping them (keep the SSRF filter at fetch time, where it belongs). Accept ' — ', ' - ' and next-line indented text as descriptions. Handle `[a](url "title")` and `[a](<url>)`. Then re-tune the ratio thresholds against real llms.txt files, and return notApplicable() when llms.txt is absent.

**False-positive risks:**
- `extractMarkdownLinks()` filters with `if (!/^https?:\/\//i.test(c) …) return;` — every relative link (`- [Home](/): Main landing page`) is discarded. The audit's own recommended snippet uses relative links, so following the fix produces the failure.
- Description capture is `(?::\s*([^\n]+))?` anchored immediately after `)`. The equally common `- [Name](url) — description` and `- [Name](url)\n  description` forms are counted as undescribed, driving a real full-description file below the 0.5 ratio and into FAIL.
- The inline regex `\[([^\]]+)\]\(([^)\s]+)\)` cannot match titled links `[a](url "title")` or angle-bracket URLs `[a](<url>)`; those links vanish from both numerator and denominator, skewing the ratio arbitrarily.
- `clean()` strips trailing `)`/`.`/`]`/`` ` `` from URLs, corrupting legitimate URLs containing parentheses.
- Dedupe by URL means a site that lists the same URL under two sections is counted once, so ratios do not reflect the file's actual content.
- 0.5 and 1.0 ratio cut-offs are arbitrary and undocumented — 49% described is FAIL, 51% is WARN.

**Test gaps:**
- llms.txt using relative links — currently produces a wrong verdict and is untested
- '- [Name](url) — description' dash separator form
- Titled links `[a](url "title")`
- URLs containing parentheses
- Nested/indented list items and numbered lists
- Duplicate URLs across sections

**Overlaps with:** `1.5`, `1.1`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** An agent reading `/llms.txt` uses the `: description` note after each link to decide which of the linked pages to fetch, so links without a note cause the agent to fetch pages it would otherwise skip.

**Grade: C** — the note is a spec-defined optional element that the format's reference parser exposes as a per-link `desc` field, and vendor tooling (Chrome Lighthouse) treats the link list itself as the point of the file — but no vendor documents a named agent pruning fetches on the basis of those notes.

**Evidence:**
- The llms.txt spec defines the link entry as "a required markdown hyperlink `[name](url)`, then optionally a `:` and notes about the file" — the description is part of the format, and explicitly optional — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation emits each link as an object with `title`, `url` and an optional `desc`, so the note is a first-class parsed field rather than free text — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- The `llms_txt2ctx` CLI built on that parser expands the listed links into a single LLM context document, which is the concrete consumption path the audit's rationale assumes — https://pypi.org/project/llms-txt/ (verified 2026-08-21)
- Chrome's agentic-browsing Lighthouse audit fails an llms.txt that contains no markdown links at all (`/\[.+\]\(.+\)/`, message "File does not appear to contain any links"), corroborating that the described link list — not the prose — is the payload — https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js (verified 2026-08-21)

**Counter-evidence:** The same Lighthouse audit stops at "contains at least one link" and checks nothing about descriptions, so even the one vendor-shipped llms.txt checker does not treat the note as required (https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js, verified 2026-08-21). The spec marks the note "optional" (https://llmstxt.org/, verified 2026-08-21), so the audit's 50%-described FAIL threshold has no basis in any published source. Google states Search ignores llms.txt and that no AI text file is needed for its generative features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Measured traffic shows named AI assistants accounted for only 37 of ~770 llms.txt fetches over two months, while ~15% of agent page reads came through `Accept:`-negotiated Markdown instead — i.e. the observed agent path bypasses llms.txt (https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured, verified 2026-08-21). OpenAI (https://developers.openai.com/api/docs/bots) and Perplexity (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) document robots.txt only and never mention llms.txt (both verified 2026-08-21).
