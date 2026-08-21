---
audit: meta-tags/llms-full-txt-link
audit_id: "4.12"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/llms-full-txt-link.ts
slug: llms-full-txt-link
review_verdict: merge
severity: medium
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# llms-full-txt-link (`4.12`)

> meta-tags · source `llms-full-txt-link.ts` · review verdict **merge** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

The llms-full.txt file provides AI agents with a comprehensive, unabridged version of your content optimized for ingestion into context windows. Adding this link in <head> lets agents choose between the summary (llms.txt) and full content versions based on their context budget.

## Code review findings (2026-08-20, 11-agent pass)

A byte-for-byte copy of llms-txt-link (4.11) with one substring changed ('llms' → 'llms-full'), measuring the same underlying signal — presence of an llms-family alternate link — and inheriting every one of that audit's matching defects. Because 4.11's looser `includes('llms')` already matches this link, the two audits are entangled: one file can satisfy both. Charging a separate 'medium' priority failure for the second variant of a non-standard tag is double-penalizing speculation.

**Required fix:** Merge into LlmsTxtLinkAudit (4.11) as a single 'llms.txt discovery' audit that reports which llms-family resources are linked (index, full, or neither), passing on the index alone and noting the full variant as a bonus. If kept separate, it must at minimum stop depending on `title.includes('llms-full')` — match `href` against `/llms-full\.txt$/i` — accept `text/markdown` and parameterized MIME types, drop the exact `l.rel === 'alternate'` comparison in favor of a normalized one, and be downgraded from 'medium' to 'low' given zero documented consumption.

**False-positive risks:**
- Identical title-dependence to 4.11: `(l.title ?? '').toLowerCase().includes('llms-full')` fails on `<link rel="alternate" type="text/plain" href="/llms-full.txt">` with no title — correct, minimal markup rejected.
- Identical MIME rigidity: `l.type === 'text/plain'` rejects `text/markdown` and any `; charset=` parameter.
- Title-vs-href mismatch: a site could title the link 'Full documentation for LLMs' (no 'llms-full' substring) and fail while serving exactly the right file.
- Entangled with 4.11: because 4.11 matches on `includes('llms')`, a site that ships only llms-full.txt passes 4.11 and 4.12, while a site that ships only llms.txt passes 4.11 and fails 4.12 at medium priority — the pair does not partition the space cleanly.
- `l.rel === 'alternate'` exact/case-sensitive.
- Only `ctx.pages[0]` is examined.
- Recommending llms-full.txt at 'medium' priority pushes site owners toward maintaining a second, larger generated artifact for which no consumer is identified — real cost, unverified benefit.

**Test gaps:**
- No link-without-title test.
- No `type="text/markdown"` / charset-parameter test.
- No uppercase/multi-token `rel` test.
- Only 3 tests, one of which (the llms.txt-titled link failing) merely locks in the title-substring coupling rather than questioning it.
- No test of the 4.11/4.12 interaction on a site that has only one of the two files.

**Overlaps with:** `4.11`

## Evidence

### Signal: HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown") — grade C (llms-txt)

**Mechanism:** Emitting <link rel="describedby" href="/llms.txt"> and/or <link rel="alternate" type="text/markdown" href="...md"> in the HTML head (or the equivalent HTTP Link: header) causes agents to discover and fetch those resources. FALSIFIABLE TEST: does any published spec define these relations, and does any named agent parse them?

**Evidence:** REAL, NOT INVENTED — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations: rel="alternate" type="text/markdown" points to the markdown version of a page and rel="describedby" points to the covering llms.txt, deliverable as HTML <link> elements or as an HTTP Link: header (the header form also working for non-HTML resources and configurable at CDN level). This was the headline addition in v2. Deployment exists: I confirmed developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value WOULD be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has NO known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; I fetched that hypothesized URL and got HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and I could not independently corroborate it; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites I sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.
**Consumers:** OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated), none-known for rel=describedby -> llms.txt · **Recommended tier:** experimental

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/sunset/meta-tags/llms-full-txt-link.md](../../sunset/meta-tags/llms-full-txt-link.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
