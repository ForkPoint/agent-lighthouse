---
audit: machine-discovery/llms-txt-link-descriptions
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-link-descriptions.ts
slug: llms-txt-link-descriptions
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - llmstxt-spec-link
  - llms-txt-core-source
  - llms-txt-pypi
  - lighthouse-llms-txt-audit-source
  - google-ai-optimization-mythbusting
  - evil-martians-llm-traffic
  - s18
  - perplexity-crawlers-docs
---

# llms-txt-link-descriptions (`1.4`)

> content-discoverability · source `llms-txt-link-descriptions.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Link descriptions help AI agents understand what each page covers without visiting it, reducing unnecessary crawling.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An agent reading `/llms.txt` uses the `: description` note after each link to decide which of the linked pages to fetch, so links without a note cause the agent to fetch pages it would otherwise skip.

**Grade: C** — the note is a spec-defined optional element, and the format's reference parser exposes it as a per-link `desc` field. Vendor tooling, Chrome Lighthouse included, treats the link list itself as the point of the file. But no vendor documents a named agent pruning fetches on the basis of those notes.

**Evidence:**

- The llms.txt spec defines the link entry as "a required markdown hyperlink `[name](url)`, then optionally a `:` and notes about the file" — the description is part of the format, and explicitly optional — https://llmstxt.org/ (verified 2026-08-21)
- The reference implementation emits each link as an object with `title`, `url` and an optional `desc`, so the note is a first-class parsed field rather than free text — https://raw.githubusercontent.com/AnswerDotAI/llms-txt/main/llms_txt/core.py (verified 2026-08-21)
- The `llms_txt2ctx` CLI built on that parser expands the listed links into a single LLM context document, which is the concrete consumption path the audit's rationale assumes — https://pypi.org/project/llms-txt/ (verified 2026-08-21)
- Chrome's agentic-browsing Lighthouse audit fails an llms.txt that contains no markdown links at all. The test is `/\[.+\]\(.+\)/`, and the message is "File does not appear to contain any links". That corroborates that the described link list, not the prose, is the payload — https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js (verified 2026-08-21)

**Counter-evidence:** The same Lighthouse audit stops at "contains at least one link" and checks nothing about descriptions, so even the one vendor-shipped llms.txt checker does not treat the note as required (https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/agentic/llms-txt.js, verified 2026-08-21). The spec marks the note "optional" (https://llmstxt.org/, verified 2026-08-21), so the audit's 50%-described FAIL threshold has no basis in any published source. Google states Search ignores llms.txt and that no AI text file is needed for its generative features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). Measured traffic shows named AI assistants accounted for only 37 of ~770 llms.txt fetches over two months, while ~15% of agent page reads came through `Accept:`-negotiated Markdown instead — i.e. the observed agent path bypasses llms.txt (https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured, verified 2026-08-21). OpenAI (https://developers.openai.com/api/docs/bots) and Perplexity (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) mention llms.txt on their crawler pages only as the index of their own documentation. Neither says its crawlers read another site's llms.txt (both verified 2026-10-18).
