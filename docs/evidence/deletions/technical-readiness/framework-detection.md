---
audit: technical-readiness/framework-detection
category: technical-readiness
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# framework-detection — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned two ways. (a) Diagnostic proxy: framework identity predicts rendering mode, so detecting Create React App or a Vue SPA is an early warning that the page is invisible to non-rendering AI crawlers, and detecting Next.js/Astro/Nuxt predicts server-rendered HTML. (b) Agent interaction: an AI browsing agent that knows the stack could adapt its strategy — waiting for hydration, expecting client-side routing, targeting framework-specific DOM hooks. For the audit to matter, either a named AI consumer must treat framework identity as a signal, or framework identity must carry rendering information not already obtainable by looking at the delivered HTML.

## What we searched

With WebSearch exhausted I fetched Google's JavaScript SEO Basics doc, the authoritative vendor statement on whether framework choice matters versus rendering outcome. I checked OpenAI's crawler docs, Anthropic's crawler support article, and Perplexity's bot docs for any statement about rendering capability or framework handling. Via the arXiv API I enumerated 30 recent GEO/AEO papers and fetched 'Designing Agent-Ready Websites for AI Web Agents' (2607.12056), the paper most directly aimed at this product's problem space, to see whether framework detection appears anywhere in an agent-readiness framework. I also read the sibling audit technical-readiness/server-rendered.ts in the codebase to test whether framework detection adds any information beyond it, and read framework-detection.ts's own detection logic.

## Best evidence found for the audit

Weakest of the four. The best I found is indirect and cuts against the audit: Google confirms not all crawlers render — 'server-side or pre-rendering is still a great idea because it makes your website faster for users and crawlers, and not all bots can run JavaScript' — which validates the RENDERING concern but says nothing about framework identity. No vendor doc from Google, OpenAI, Anthropic, Microsoft or Perplexity names a framework or treats framework choice as a factor. The academic paper purpose-built for agent-readiness (2607.12056) structures the problem as 'agent interpretability, agent executability, and agent decision reliability' via 'machine readability, semantic clarity, agent actionability, and contextual decision-reliability signals' — framework identity is not a dimension. No named consumer of this signal exists.

## Counter-evidence

(1) Google states the opposite of the audit's premise. Its JavaScript SEO guidance names no framework and frames the question purely as rendering outcome: content must be in the DOM, links must be real <a href> anchors, 'once Google's resources allow, a headless Chromium renders the page'. Framework choice is presented as irrelevant to Google's ability to process the page. (2) The audit is fully redundant with a sibling that measures the outcome directly: technical-readiness/server-rendered.ts (id 8.13, priority critical) counts words and characters in the delivered <main> and fails when content is absent — that is the real, ground-truth measurement of the only thing framework identity was proxying for. A proxy is strictly worse than the direct measurement it stands in for and is already sitting next to it. (3) The audit cannot produce a finding: scoreDisplayMode is 'informative' and every code path returns this.pass(), including the 'No specific frontend framework clearly detected' branch, so it never fails, never warns, and never surfaces an action — its own guidance says 'No action required.' (4) Its detection is additionally unsound: '[data-v-]' is not a valid attribute-prefix selector (Vue emits hashed attributes like data-v-7ba5bd90, which this never matches); the Nuxt branch reads (globalThis as {window}).window?.__NUXT__, which is always undefined in the Node scanner since there is no browser context; and script[src*="react"] / script[src*="vue"] match any bundle filename containing those substrings, so the output is unreliable even as trivia. (5) No AI crawler doc discloses rendering behavior at all (OpenAI, Anthropic, Perplexity docs are silent), so framework identity cannot even be mapped to a known consumer's capability.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. There is no documented consumer: no vendor treats framework choice as an AI-readiness factor, and Google explicitly frames the issue as rendering outcome rather than tooling. The purpose-built agent-readiness literature does not include framework identity among its dimensions. The audit is a strictly inferior proxy for server-rendered.ts, which already measures the actual outcome at critical priority; it is hard-wired to always pass and self-describes as requiring no action; and its detection heuristics are broken in three separate places. Delete it. If stack identification is wanted for report colour, it belongs in scan metadata, not as an audit — and it should not be presented as an AI-readiness signal.

## Sources

- **[JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Names no JavaScript framework and never states that framework choice matters. Frames everything as rendering outcome: 'Keep in mind that server-side or pre-rendering is still a great idea because it makes your website faster for users and crawlers, and not all bots can run JavaScript', and 'Once Google's resources allow, a headless Chromium renders the page and executes the JavaScript.' Requirements are content in the DOM and crawlable <a href> links, not a particular stack.
- **[Designing Agent-Ready Websites for AI Web Agents](https://arxiv.org/abs/2607.12056)** — arXiv (study, URL verified 2026-08-21)
  - Structures agent readiness as 'agent interpretability, agent executability, and agent decision reliability', supported by 'machine readability, semantic clarity, agent actionability, and contextual decision-reliability signals', with improvements in 'structural clarity, action cues, evidence signals, and temporal validity indicators'. Framework identity, framework detection and client-side rendering are absent from the framework; it also notes GEO metrics do not fully assess agent-readiness.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - No statement about JavaScript execution, rendering, or frameworks for GPTBot, OAI-SearchBot or ChatGPT-User. Documentation is limited to user agents, IP ranges, robots.txt and use cases — so framework identity cannot be mapped to any disclosed consumer capability.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Provides no technical specification about rendering capabilities or content discovery for ClaudeBot, Claude-User or Claude-SearchBot; scope is robots.txt honoring and Crawl-delay support.
- **[agent-lighthouse server-rendered.ts (audit 8.13)](https://github.com/ForkPoint/agent-lighthouse/blob/main/packages/core/src/audits/technical-readiness/server-rendered.ts)** — ForkPoint / agent-lighthouse (repo, URL verified 2026-08-21)
  - Sibling audit at critical priority that directly measures the delivered HTML ('Homepage <main> has > 50 words or > 200 characters of text content') and fails client-side-only pages. This is the ground-truth measurement that framework detection merely proxies, making 8.21 redundant. Read from the local working copy at /Users/kirov/dev/forkpoint/agent-lighthouse/packages/core/src/audits/technical-readiness/server-rendered.ts; the GitHub URL was not fetched.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
