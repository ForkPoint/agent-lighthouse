---
audit: agent-interfaces/ai-catalog-link
audit_id: "4.19"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-link.ts
slug: ai-catalog-link
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-catalog-link (`4.19`)

> meta-tags · source `ai-catalog-link.ts` · review verdict **delete** · evidence grade **B** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

The AI Catalog provides a structured manifest of all AI-consumable resources on your site (APIs, datasets, tools). An AI Catalog link in <head> lets agents discover your full range of machine-readable content in a single request instead of crawling your entire site.

## Code review findings (2026-08-20, 11-agent pass)

The clearest falsy audit in the category. It fails 100% of real websites for omitting a file format that does not exist outside this codebase, while the failure text asserts a concrete cost ('agents must crawl your entire site to discover AI-consumable resources'). A user who follows the fix will author an ai-catalog.json that no agent will ever request. This is the definition of a misleading audit and should be removed.

**Required fix:** Delete. Real 'discover this site's machine-readable resources in one request' signals that do exist and are worth auditing instead: sitemap.xml, llms.txt's link index, /.well-known/ resources, and published OpenAPI/MCP endpoints. If the maintainer genuinely wants to promote an AI Catalog convention, it must be labeled clearly as a proposal (informational, weight 0, never a scored failure) with an honest note that no consumer implements it — not presented as something 'agents' use.

**False-positive risks:**
- Universal false failure: no site on the public web emits `<link rel="alternate" type="application/json" title="AI Catalog">`, so the audit returns a scored fail on every real scan and measures nothing about the site.
- Fabricated impact claim: the failure states the catalog 'lets them find everything in a single request, dramatically improving discovery efficiency' — an unverifiable claim about a format with no consumer. Users are given a concrete effort estimate ('moderate') for zero return.
- Title-substring matching: `(l.title ?? '').toLowerCase().includes('ai catalog')` requires the exact English two-word phrase with a space; a site following the audit's own advice but titling the link 'AI-Catalog' or 'AICatalog' fails its own standard.
- `l.rel === 'alternate'` and `l.type === 'application/json'` are exact, case-sensitive matches that also reject `application/json; charset=utf-8`.
- Only `ctx.pages[0]` is examined.
- The `/* v8 ignore start */` wrapper around the entire matching expression means the discriminating logic is deliberately excluded from coverage measurement — the one piece of logic in the file is untested by construction.
- Combined with 4.13, 4.14, 4.17 and 4.18, five invented-standard audits impose a fixed, unavoidable score penalty on every well-built site, which systematically understates the meta-tags score.

**Test gaps:**
- No test of title variants ('AI-Catalog', 'AICatalog', non-English) against the audit's own required phrase.
- No charset-parameter or uppercase-`rel` test.
- The matching logic is explicitly `v8 ignore`d, so coverage tooling cannot flag how untested it is.
- No test establishing that any consumer exists — the suite validates a self-defined contract.
- Only 3 tests.

**Overlaps with:** `4.17`, `4.18`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/meta-tags/ai-catalog-link.md](../../deletions/meta-tags/ai-catalog-link.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
