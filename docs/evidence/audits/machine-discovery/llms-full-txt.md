---
audit: machine-discovery/llms-full-txt
audit_id: "1.6"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-full-txt.ts
slug: llms-full-txt
review_verdict: fix
severity: medium
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
---

# llms-full-txt (`1.6`)

> content-discoverability · source `llms-full-txt.ts` · review verdict **fix** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

llms-full.txt provides the complete content of your site in a single file, allowing AI agents to ingest everything in one request instead of crawling page by page.

## Code review findings (2026-08-20, 11-agent pass)

Fails any site lacking /llms-full.txt, at HIGH priority, on the strength of a 200 status alone — no content check whatsoever. llms-full.txt is a real convention (Mintlify and several doc platforms emit it) but it is explicitly optional even in the llms.txt spec, is only meaningful for documentation-shaped sites, and is actively inappropriate for large or commerce sites. Failing every site for its absence at high priority is misleading; passing any 200 makes the pass meaningless.

**Required fix:** Require 200 AND a non-HTML content-type AND a markdown-shaped body over a minimum size (say 2KB) to pass. Return notApplicable() rather than fail() when the file is absent — it is an optional enhancement, not a defect — or gate it to documentation-type sites. Drop defaultPriority from high to low.

**False-positive risks:**
- `isOk` status-only: an SPA catch-all serving `<!doctype html>` at /llms-full.txt yields PASS 'llms-full.txt exists and returns HTTP 200'. So does a 200 error page, a redirect to the homepage, or a 0-byte file.
- No size or format floor — a one-line placeholder file scores identically to a genuine full-content dump, so the audit rewards the gesture rather than the content.
- A 30k-page ecommerce catalogue cannot meaningfully produce llms-full.txt; the audit still marks it a HIGH-priority failure with 'moderate' effort guidance that is not actionable.
- Body is truncated at MAX_RESPONSE_BODY_BYTES (5MB) by the fetcher, so any real llms-full.txt of consequence is partially read — currently harmless because nothing is inspected, but it blocks any future content check.

**Test gaps:**
- 200 + HTML soft-404 (currently a false PASS)
- Empty or 1-line placeholder file (currently a false PASS)
- Redirect to homepage returning 200
- Very large body hitting the 5MB fetcher truncation
- Non-markdown content types

**Overlaps with:** `1.1`

## Evidence

### Signal: /llms-full.txt (full concatenated documentation file) — grade D (llms-txt)

**Mechanism:** Publishing /llms-full.txt containing the site's complete documentation as one markdown file causes AI agents to ingest the full corpus in a single fetch, improving answer accuracy versus llms.txt alone. FALSIFIABLE TEST: presence in any published spec; AI-agent fetch rate; whether file size is ingestible within production context windows.

**Evidence:** WEAKEST SIGNAL IN THE DOMAIN. It is not in the spec at all — I read both llmstxt.org v2 and its changes page and llms-full.txt appears in neither; it is a community extension popularized when Mintlify enabled it platform-wide in Nov 2024. Adoption is marginal and purely derivative: 15 of the Tranco top 1,000 (1.5%), and tellingly ZERO sites publish llms-full.txt without also publishing llms.txt, meaning no one adopts it on its own merits. Google's Lighthouse gatherer does not fetch it (source verified: root /llms.txt only). No vendor documentation from OpenAI, Anthropic, Google or Perplexity references consuming it. The single pro-claim is Mintlify relaying Profound's assertion that 'LLMs are accessing llms-full.txt even more frequently than the original llms.txt' — with no sample size, no methodology, and no dataset, from a vendor that sells the feature.

**Counter-evidence:** My own measurement is close to disqualifying: Anthropic's llms-full.txt is 33.5 MB, Cloudflare's is 57.3 MB, OpenAI's 6.1 MB, Perplexity's 4.1 MB. At roughly 4 chars/token these are ~8M, ~14M, ~1.5M and ~1M tokens — one to two orders of magnitude beyond any production context window, so the stated mechanism (single-fetch full ingestion) is physically impossible for the very sites held up as exemplars. Stripe returns 404 for it while maintaining a 92 KB llms.txt, suggesting deliberate rejection. Mintlify caps auto-generated llms.txt at 100,000 characters but applies no cap to llms-full.txt, which is how these files reach absurd sizes. Serving a 57 MB file to any agent that requests it is also a real bandwidth and abuse liability.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [The value of llms.txt: Hype or real?](https://www.mintlify.com/blog/the-value-of-llms-txt-hype-or-real) · [LLMS.txt Adoption Tracker (Tranco top 1,000)](https://www.rankability.com/data/llms-txt-adoption/) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/content-discoverability/llms-full-txt.md](../../deletions/content-discoverability/llms-full-txt.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
