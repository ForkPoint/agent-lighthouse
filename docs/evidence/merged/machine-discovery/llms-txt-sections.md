---
audit: machine-discovery/llms-txt-sections
audit_id: "1.3"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-sections.ts
slug: llms-txt-sections
review_verdict: merge
severity: low
evidence_grade: C
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# llms-txt-sections (`1.3`)

> content-discoverability · source `llms-txt-sections.ts` · review verdict **merge** · evidence grade **C** · disposition: **merge (approved 2026-08-21)**

## What it checks

H2 sections help AI agents navigate your llms.txt by topic. Without them, agents must scan the entire file linearly.

## Code review findings (2026-08-20, 11-agent pass)

Counts lines matching /^##\s/ in llms.txt. Purely cosmetic: 'has at least one H2' is a trivially satisfiable box-tick with no demonstrated effect on any agent's behaviour, and it is scored at the same full weight as 'sitemap exists'. Same missing-file miscategorisation as 1.2. Merge with 1.2 into one llms.txt structure audit.

**Required fix:** Merge into the combined llms.txt structure audit (with 1.2). Skip fenced code blocks when counting headings, treat 'no H2' as a warn/low at most (or notApplicable for short files), and return notApplicable() when llms.txt is absent.

**False-positive risks:**
- `/^##\s/.test(l.trimStart())` counts H2 lines inside fenced code blocks and inside blockquote-quoted examples, so a file demonstrating llms.txt syntax scores its own examples as real sections.
- A perfectly usable single-topic llms.txt with a flat, well-described link list and no H2 is graded FAIL at medium priority — the spec does not require sections.
- `trimStart()` means an indented `  ## x` inside a list item counts.
- Absent llms.txt returns fail with priority 'critical' rather than notApplicable, adding a third critical entry for one missing optional file.

**Test gaps:**
- '##' inside a ``` fenced block
- '###' / '####' only (no true H2)
- Setext-style H2 ('Section\n---')
- llms.txt absent vs. HTML soft-404 distinction

**Overlaps with:** `1.1`, `1.2`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** An agent consuming `/llms.txt` uses the H2 section headings to select which subset of the listed links to fetch, so a file with no H2 section causes the agent to retrieve links it would otherwise skip.

**Grade: C** — H2 sections are spec-defined and carry one documented agent behaviour (a section named "Optional" marks links an agent may skip), and the reference parser exposes them as a `sections` map — but the spec makes sections explicitly optional and no consumer is documented to behave differently when a file has none.

**Evidence:**
- The llms.txt spec defines "Zero or more markdown sections delimited by H2 headers, containing 'file lists'", and attaches behaviour to one specific heading: the "'Optional' section is used, by convention, for secondary information: links an agent can skip when a shorter context is needed" — the only agent-visible semantics the format assigns to a section heading — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation returns `sections` as a dict mapping section names to their parsed link lists, so an H2 heading is a real addressable key for tooling built on the format — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- The `llms_txt2ctx` CLI that consumes those sections is published and installable — https://pypi.org/project/llms-txt/ (verified 2026-08-21)
- Chrome ships an agentic-browsing Lighthouse audit for llms.txt, giving the format vendor-tool recognition — https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt (verified 2026-08-21)

**Counter-evidence:** The spec's own wording ("Zero or more") makes a section-free llms.txt fully conformant, so this audit's "at least one `##`" bar is stricter than the standard it cites (https://llmstxt.org/, verified 2026-08-21). Chrome's Lighthouse llms.txt audit checks only H1, at least one markdown link and a 50-character minimum — it does not check for H2 sections (https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js, verified 2026-08-21). Google states Search "ignores" llms.txt and similar AI text files entirely (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Measured logs show only 37 of ~770 llms.txt/llms-full.txt fetches over two months came from named AI assistants (https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured, verified 2026-08-21). Neither OpenAI's (https://developers.openai.com/api/docs/bots) nor Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mentions llms.txt (both verified 2026-08-21). No source anywhere claims a measured difference in agent behaviour between a sectioned and an unsectioned file.

**Merged into:** `machine-discovery/llms-txt-structure` (Plan 4, 2026-08-22) — [merged dossier](../../audits/machine-discovery/llms-txt-structure.md)
