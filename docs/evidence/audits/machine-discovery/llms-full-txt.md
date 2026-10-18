---
audit: machine-discovery/llms-full-txt
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-full-txt.ts
slug: llms-full-txt
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-10-18
recommended_tier: delete
tier_rationale: "Recommended delete; ships informative. The retirement was re-verified on 2026-08-24 and withdrawn — the file is a documented community convention with no consumer, which is what informative reports (evidence sweep, 2026-08-24)."
consumers: []
signals:
  - name: /llms-full.txt (full concatenated documentation file)
    grade: C
    domain: llms-txt
sources:
  - llmstxt-spec-link
  - llmstxt-org-changes
  - mintlify-llmstxt-docs
  - mintlify-value-of-llmstxt
  - rankability-adoption-tracker
  - lighthouse-llms-txt-gatherer-source
  - ahrefs-llmstxt-study
---

# llms-full-txt (`1.6`)

> content-discoverability · source `llms-full-txt.ts` · review verdict **fix** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

Whether `GET /llms-full.txt` returns 200 with a body that is not an HTML page. llms-full.txt is a companion convention to llms.txt: the site's content in one markdown file. Nothing else about the file is checked.

## Why it matters

No AI vendor documents reading llms.txt or llms-full.txt from a website at runtime. An [Ahrefs study of 137,210 domains](https://ahrefs.com/blog/llmstxt-study/) (verified 2026-10-18) found that 97% of llms.txt files received no requests in a month. AI tools never asked for a missing file. Tools a user points at the file, such as documentation helpers in coding agents, can still read it.

## How it scores

Informative, weight 0. Every result carries an `unconsumed` notice: no AI vendor documents reading this file. The audit never warns or fails. An absent file is not applicable. A file that is present passes, and nothing further is checked; presence is named in the pass message, with the note that it does not affect AI agents.

## Evidence

### Signal: /llms-full.txt (full concatenated documentation file) — grade C (llms-txt)

**Mechanism:** Publishing /llms-full.txt containing the site's complete documentation as one markdown file causes AI agents to ingest the full corpus in a single fetch, improving answer accuracy versus llms.txt alone. FALSIFIABLE TEST: presence in any published spec; AI-agent fetch rate; whether file size is ingestible within production context windows.

**Evidence:** This is the weakest signal in the domain. It is not in the spec at all — both llmstxt.org v2 and its changes page and llms-full.txt appears in neither; it is a community extension popularized when Mintlify enabled it platform-wide in Nov 2024. Adoption is marginal and purely derivative: 15 of the Tranco top 1,000 (1.5%), and tellingly zero sites publish llms-full.txt without also publishing llms.txt, meaning no one adopts it on its own merits. Google's Lighthouse gatherer does not fetch it (source verified: root /llms.txt only). No vendor documentation from OpenAI, Anthropic, Google or Perplexity references consuming it. The single pro-claim is Mintlify relaying Profound's assertion that 'LLMs are accessing llms-full.txt even more frequently than the original llms.txt' — with no sample size, no methodology, and no dataset, from a vendor that sells the feature.

**Grade:** C, the policy's community-convention row. Documentation publishers use the file, and nothing documents consuming it. The signal grade used to read D while the audit read C; both now read C (2026-10-18).

**Counter-evidence:** A measurement taken for this dossier is close to disqualifying. Anthropic's llms-full.txt is 33.5 MB, Cloudflare's is 57.3 MB, OpenAI's 6.1 MB, Perplexity's 4.1 MB. At roughly 4 characters per token these are about 8M, 14M, 1.5M and 1M tokens. That is one to two orders of magnitude beyond any production context window. The stated mechanism, single-fetch full ingestion, is therefore physically impossible for the very sites held up as exemplars. Stripe returns 404 for it while maintaining a 92 KB llms.txt, suggesting deliberate rejection. Mintlify caps auto-generated llms.txt at 100,000 characters but applies no cap to llms-full.txt, which is how these files reach absurd sizes. Serving a 57 MB file to any agent that requests it is also a real bandwidth and abuse liability.

## Implementation deviations

- **The grade is C, not the signal's D.** Cloudflare AI Index generates the
  file for customers. That is partial adoption by a generator, not a consumer.
- **An absent file is not applicable.** A 200 whose body opens as an HTML
  document counts as absent (`isRootArtifact` in `gatherers/root-files.ts`).
- **Report only, from 2026-10-18.** The 2026-10-18 consumer review (policy.md, "Informative or obsolete") keeps this audit informative with an `unconsumed` notice and removes every warn and fail. Verdicts did not change: the audit never warned or failed. The description, impact and fix text no longer claim that AI agents read the file, and the default priority moved from high to low.
