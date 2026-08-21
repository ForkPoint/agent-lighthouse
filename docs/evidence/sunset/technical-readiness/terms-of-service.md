---
audit: technical-readiness/terms-of-service
audit_id: "8.20"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/terms-of-service.ts
slug: terms-of-service
status: sunset
review_verdict: fix
severity: high
evidence_grade: D
disposition: "removed — sunset 2026-08-21 (v2 taxonomy grading pass)"
reviewed: 2026-08-21
---

# terms-of-service (`8.20`)

> technical-readiness · source `terms-of-service.ts` · review verdict **fix** · evidence grade **D** · disposition: **removed — sunset 2026-08-21 (v2 taxonomy grading pass)**

## What it checks

AI agents check for terms of service to determine whether automated access is permitted. A missing ToS page creates legal ambiguity that may cause enterprise AI systems to avoid recommending your site. Clear terms also let you specify AI usage policies for your content.

## Code review findings (2026-08-20, 11-agent pass)

A line-for-line twin of 8.19 with the nouns swapped — same path probe, same `findXLink` anchor scanner, same early-return, same failure structure — and it inherits every one of the same defects: a status-only path check that a soft-404 turns into a false pass, and an English-only regex pair (`TERMS_TEXT`, `TERMS_HREF`) that fails compliant German (AGB), French (CGU/CGV), Spanish (Términos), and Japanese (利用規約) sites. It additionally probes only two paths (/terms/, /terms) where 8.19 probes four, so it is strictly more dependent on the fragile anchor fallback. The 'AI agents check for terms of service to determine whether automated access is permitted' rationale is aspirational — agents read robots.txt and increasingly TDM/AI-usage signals, not prose ToS.

**Required fix:** Merge the shared scanner with 8.19 into one `_legal-links.ts` helper (path list + i18n label/slug table + `looksLikeRealPage()` body validation + aria-label fallback), then keep 8.19 and 8.20 as thin callers. Add `/policies/terms-of-service` and `/legal/terms` to the probed paths since the orchestrator already fetches the former. Rewrite the impact copy to drop 'AI agents check for terms of service to determine whether automated access is permitted' in favor of the honest commerce/compliance framing, and point users at robots.txt/TDM signals for the automated-access question.

**False-positive risks:**
- Soft-404 false PASS: `ctx.rootFiles['/terms/'].status === 200` with no content validation; SPA catch-alls and 200-search-page CMSes make every such site 'pass'.
- English-only false FAIL: `TERMS_TEXT = /\bterms\s*(of\s*(service|use|sale)|&\s*conditions|and\s*conditions)\b|\bconditions\s*of\s*use\b/` and `TERMS_HREF` covering `/terms…`, `/tos`. German AGB (/agb), French CGU (/cgu, /conditions-generales), Japanese 利用規約, Russian Условия — none match either pattern.
- Narrower path list than its twin: only `['/terms/', '/terms']`, while the orchestrator also fetches `/policies/terms-of-service` (the Shopify default) — that entry exists in `rootFilePaths` but the audit never checks it, so a standard Shopify store falls through to the anchor scan unnecessarily.
- Same anchor-scan blind spots as 8.19: `page.$(el).text()` misses aria-label-only links; client-rendered footers expose no anchors; only crawled pages are scanned.
- The exact-match shortcuts (`text === 'terms'`, `text === 'terms & conditions'`) are redundant with the regex and encode the assumption of lowercase-normalized English labels.

**Test gaps:**
- No test for a 200 soft-404 (false pass).
- No non-English test (AGB, CGU, 利用規約, Términos).
- No test for `/policies/terms-of-service`, the Shopify default the orchestrator already fetches.
- No test for aria-label-only or icon-only footer links.
- No test where the footer is client-rendered.

**Overlaps with:** `8.19`, `8.7`

## Evidence

### Signal: TDM Reservation Protocol (W3C tdm-rep) and EU AI Act TDM opt-out legal weight — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: publishing a TDM reservation via /.well-known/tdmrep.json, the tdm-reservation / tdm-policy HTTP headers, or an HTML meta tag causes AI training crawlers to refrain from mining the content, and carries binding legal weight under EU AI Act Article 53(1)(c). FALSIFIABLE FORM: a named GPAI provider fetches and honours tdmrep.json, or a published EU list of recognised opt-out protocols names TDM-Rep.

**Evidence:** The legal frame is real, and that is the whole of the trajectory argument. EU AI Act Art. 53(1)(c) obliges GPAI providers to 'identify and comply with, including through state-of-the-art technologies, a reservation of rights expressed pursuant to Article 4(3) of Directive (EU) 2019/790'. The GPAI Code of Practice Copyright Chapter Measure 1.3 turns that into a commitment to crawlers that 'read and follow instructions expressed in accordance with the Robot Exclusion Protocol (robots.txt), as specified in... RFC 9309', plus 'other appropriate machine-readable protocols' that are 'state-of-the-art... and widely adopted by rightsholders'. The Commission ran a consultation (1 Dec 2025 – 23 Jan 2026) and committed to 'publish the list of generally-agreed machine-readable opt-out solutions', reviewed at least every two years. The W3C spec itself is well-formed: three delivery methods, boolean tdm-reservation, and tdm-policy pointing to an ODRL 2.2 document.

**Counter-evidence:** Damning on every practical axis. (1) The W3C document is a Final COMMUNITY GROUP Report (Feb 2024), not a W3C Recommendation — it carries no Standards Track standing. (2) The spec names essentially one implementer (an 'swpawning.ai' API); no AI model provider is listed as a consumer. (3) Neither the AI Act Article nor the Code of Practice Measure 1.3 names TDM-Rep — robots.txt / RFC 9309 is the ONLY protocol named in either, and the Commission's consultation page likewise names only 'robots.txt and subsequent IETF versions of this standard'. (4) As of this research date no EU list naming TDM-Rep has been published, so its legal weight is prospective, not established. (5) No vendor doc — OpenAI, Anthropic, Perplexity, Google, Apple — mentions tdmrep.json, and Cloudflare's opt-out machinery is built on robots.txt and its Content Signals `use` extension, not TDM-Rep. Keep as experimental strictly because the EU standardisation process is live and could name it; never score it, and never tell a user it will stop training crawlers today.
**Consumers:** none-known · **Recommended tier:** experimental

**Sources:** [TDM Reservation Protocol (TDMRep) — Final Community Group Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/) · [EU AI Act — Article 53: Obligations for providers of general-purpose AI models](https://artificialintelligenceact.eu/article/53/) · [EU AI Act: General-Purpose AI Code of Practice — Final version (10 July 2025)](https://code-of-practice.ai/) · [Commission launches consultation on protocols for reserving rights from text and data mining under the AI Act and the GPAI Code of Practice](https://digital-strategy.ec.europa.eu/en/consultations/commission-launches-consultation-protocols-reserving-rights-text-and-data-mining-under-ai-act-and) · [Your site, your rules: new AI traffic options for all customers](https://blog.cloudflare.com/content-independence-day-ai-options/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
