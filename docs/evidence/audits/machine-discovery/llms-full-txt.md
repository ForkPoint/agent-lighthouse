---
audit: machine-discovery/llms-full-txt
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-full-txt.ts
slug: llms-full-txt
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
recommended_tier: delete
tier_rationale: "Recommended delete; ships informative. The retirement was re-verified on 2026-08-24 and withdrawn — the file is a documented community convention with no consumer, which is what informative reports (evidence sweep, 2026-08-24)."
consumers: []
signals:
  - name: /llms-full.txt (full concatenated documentation file)
    grade: D
    domain: llms-txt
sources:
  - llmstxt-spec-link
  - llmstxt-org-changes
  - mintlify-llmstxt-docs
  - mintlify-value-of-llmstxt
  - rankability-adoption-tracker
  - lighthouse-llms-txt-gatherer-source
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

**Evidence:** This is the weakest signal in the domain. It is not in the spec at all — both llmstxt.org v2 and its changes page and llms-full.txt appears in neither; it is a community extension popularized when Mintlify enabled it platform-wide in Nov 2024. Adoption is marginal and purely derivative: 15 of the Tranco top 1,000 (1.5%), and tellingly zero sites publish llms-full.txt without also publishing llms.txt, meaning no one adopts it on its own merits. Google's Lighthouse gatherer does not fetch it (source verified: root /llms.txt only). No vendor documentation from OpenAI, Anthropic, Google or Perplexity references consuming it. The single pro-claim is Mintlify relaying Profound's assertion that 'LLMs are accessing llms-full.txt even more frequently than the original llms.txt' — with no sample size, no methodology, and no dataset, from a vendor that sells the feature.

**Counter-evidence:** A measurement taken for this dossier is close to disqualifying. Anthropic's llms-full.txt is 33.5 MB, Cloudflare's is 57.3 MB, OpenAI's 6.1 MB, Perplexity's 4.1 MB. At roughly 4 characters per token these are about 8M, 14M, 1.5M and 1M tokens. That is one to two orders of magnitude beyond any production context window. The stated mechanism, single-fetch full ingestion, is therefore physically impossible for the very sites held up as exemplars. Stripe returns 404 for it while maintaining a 92 KB llms.txt, suggesting deliberate rejection. Mintlify caps auto-generated llms.txt at 100,000 characters but applies no cap to llms-full.txt, which is how these files reach absurd sizes. Serving a 57 MB file to any agent that requests it is also a real bandwidth and abuse liability.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/content-discoverability/llms-full-txt.md](../../deletions/content-discoverability/llms-full-txt.md). Outcome: **dead-but-informative-candidate**, grade C.

## Re-checked (evidence sweep, 2026-08-24)

**No change: C / informative / weight 0. Correctly graded.**

The sweep that re-graded `llms-txt-exists` and `llms-txt-links-valid` covered
this file too and disturbed nothing. Two things reconfirm the C:

- The Lighthouse gatherer source, re-read on 2026-08-24, resolves
  `new URL('/llms.txt', …)` and nothing else. The one documented fetcher of the
  llms.txt family in existence never fetches `llms-full.txt`.
- llmstxt.org v2 still does not define the file, and no vendor documents
  consuming it.

One new datum, and it cuts mildly in the file's favour: Cloudflare AI Index
generates `LLMs-full.txt` alongside `LLMs.txt` for customers. That is a
generator, not a consumer, but it holds the audit at C — "community convention
with partial adoption" — rather than letting it slide back toward the D its
underlying evidence signal first assigned.

**Flagged:** `https://llmstxt.org/changes.html`, cited in this dossier, returned
HTTP 503 at access time on 2026-08-24. The changelog leg of the claim above
could not be re-verified. CI's link checker will flag it.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. `ctx.pages` and `ctx.rootFiles` carry whatever
  answered 200, which on a parked domain is a broker's page served from another
  host and on a walled, throttled or non-HTML origin is nothing about the site
  at all. The audit read them as the site's own and returned a verdict about
  somebody else. It now consults `scanReadTheSite`, the `origin-reachable`
  decision it already names in `requires`, and returns `notApplicable` with the
  gate's reason attached. Found by the hostile-state contract suite.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-24 — evidence sweep: re-checked, no change. C / informative / weight 0 stands.
