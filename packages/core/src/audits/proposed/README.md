# Proposed audits — TODO stubs

37 stub files for the proposed checks from the 2026-08-20 research pass. Every stub compiles, is **not** registered in any category index, and returns `notApplicable` until implemented. Each file's header carries its implementation sketch; full proof lives in [docs/evidence/proposals](../../../../../docs/evidence/proposals/README.md).

A stub that graduates to a shipped audit is deleted; its bullet leaves the list
below, the count above drops by one, and the audit's id joins `NEW_IN_V2` in
`packages/core/src/tests/new-in-v2.ts`.

Tier per [evidence policy](../../../../../docs/evidence/POLICY.md): grade A/B → scored, grade C → informative (weight 0).

Seven stubs left this folder on 2026-08-22 (Plan 5, Task 2): six tool surveys
moved to [docs/evidence/research](../../../../../docs/evidence/research/README.md)
because their verdict is a market fact identical for every scanned URL, and
`ai-crawler-edge-parity`, which was the same check as
`bot-auth-access/ai-crawler-edge-response-parity` and folded into
[docs/evidence/merged](../../../../../docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md).

`agentic-commerce/acp-endpoint-conformance-probe` stays a stub despite grade A:
ACP defines no discovery mechanism, so the check needs an operator-supplied
base URL, and no scan-configuration surface carries one yet. It graduates with
the `--experimental` flag work in Plan 6.


## agent-operability

- [ ] TODO [`overlay-interception-hazard`](./agent-operability/overlay-interception-hazard.ts) — Overlay Interception Hazard (grade A, scored, `headless-browser`) · [dossier](../../../../../docs/evidence/proposals/agent-operability/overlay-interception-hazard.md)

## agentic-commerce

- [ ] TODO [`acp-endpoint-conformance-probe`](./agentic-commerce/acp-endpoint-conformance-probe.ts) — ACP Endpoint Conformance Probe (grade A, informative, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md)
- [ ] TODO [`buyable-variant-resolution`](./agentic-commerce/buyable-variant-resolution.ts) — Buyable Variant Resolution (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/buyable-variant-resolution.md)
- [ ] TODO [`cart-handoff-reachability`](./agentic-commerce/cart-handoff-reachability.ts) — Cart Handoff Reachability (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/cart-handoff-reachability.md)
- [ ] TODO [`offer-truth-consistency`](./agentic-commerce/offer-truth-consistency.ts) — Offer Truth Consistency (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/agentic-commerce/offer-truth-consistency.md)

## answer-selection-forensics

- [ ] TODO [`chunk-boundary-referent-integrity`](./answer-selection-forensics/chunk-boundary-referent-integrity.ts) — Chunk-Boundary Referent Integrity (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/chunk-boundary-referent-integrity.md)
- [ ] TODO [`extractor-survival-recall`](./answer-selection-forensics/extractor-survival-recall.ts) — Extractor Survival Recall (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/extractor-survival-recall.md)
- [ ] TODO [`section-split-risk-profile`](./answer-selection-forensics/section-split-risk-profile.ts) — Section Split-Risk Profile (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/section-split-risk-profile.md)
- [ ] TODO [`site-wide-passage-uniqueness-ratio`](./answer-selection-forensics/site-wide-passage-uniqueness-ratio.ts) — Site-Wide Passage Uniqueness Ratio (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/site-wide-passage-uniqueness-ratio.md)
- [ ] TODO [`table-markdown-round-trip-loss`](./answer-selection-forensics/table-markdown-round-trip-loss.ts) — Table Markdown Round-Trip Loss (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/table-markdown-round-trip-loss.md)
- [ ] TODO [`question-heading-answer-span-alignment`](./answer-selection-forensics/question-heading-answer-span-alignment.ts) — Question-Heading Answer Span Alignment (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md)

## bot-auth-access

- [ ] TODO [`ai-usage-signal-coherence-across-channels`](./bot-auth-access/ai-usage-signal-coherence-across-channels.ts) — AI usage signal coherence across channels (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/bot-auth-access/ai-usage-signal-coherence-across-channels.md)
- [ ] TODO [`aipref-content-usage-declaration-validity`](./bot-auth-access/aipref-content-usage-declaration-validity.ts) — AIPREF Content-Usage declaration validity (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/bot-auth-access/aipref-content-usage-declaration-validity.md)
- [ ] TODO [`machine-actionable-402-paid-access-response`](./bot-auth-access/machine-actionable-402-paid-access-response.ts) — Machine-actionable 402 paid-access response (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/bot-auth-access/machine-actionable-402-paid-access-response.md)
- [ ] TODO [`rsl-licensing-terms-discoverable-and-conformant`](./bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.ts) — RSL licensing terms discoverable and conformant (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.md)
- [ ] TODO [`signed-agent-web-bot-auth-request-tolerance`](./bot-auth-access/signed-agent-web-bot-auth-request-tolerance.ts) — Signed-agent (Web Bot Auth) request tolerance (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/bot-auth-access/signed-agent-web-bot-auth-request-tolerance.md)

## competitor-gap-verify

- [ ] TODO [`content-signal-coherence`](./competitor-gap-verify/content-signal-coherence.ts) — content-signal-coherence (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/competitor-gap-verify/content-signal-coherence.md)
- [ ] TODO [`offer-dom-price-parity`](./competitor-gap-verify/offer-dom-price-parity.ts) — offer-dom-price-parity (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/competitor-gap-verify/offer-dom-price-parity.md)

## feeds-indexing

- [ ] TODO [`conditional-request-support-on-discovery-surfaces`](./feeds-indexing/conditional-request-support-on-discovery-surfaces.ts) — Conditional-request support on discovery surfaces (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/feeds-indexing/conditional-request-support-on-discovery-surfaces.md)
- [ ] TODO [`feed-entry-identity-and-canonical-integrity`](./feeds-indexing/feed-entry-identity-and-canonical-integrity.ts) — Feed entry identity and canonical integrity (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/feeds-indexing/feed-entry-identity-and-canonical-integrity.md)
- [ ] TODO [`root-text-file-resolution-integrity-indexnow-key-file-precon`](./feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.ts) — Root text-file resolution integrity (IndexNow key-file precondition) (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.md)
- [ ] TODO [`three-way-freshness-lag-and-orphaned-fresh-content`](./feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.ts) — Three-way freshness lag and orphaned fresh content (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.md)
- [ ] TODO [`websub-hub-advertisement-and-self-link-correctness`](./feeds-indexing/websub-hub-advertisement-and-self-link-correctness.ts) — WebSub hub advertisement and self-link correctness (grade C, informative, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/feeds-indexing/websub-hub-advertisement-and-self-link-correctness.md)

## injection-safety


## mcp-server-quality

- [ ] TODO [`origin-validation-and-cors-coherence`](./mcp-server-quality/origin-validation-and-cors-coherence.ts) — Origin Validation and CORS Coherence (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/origin-validation-and-cors-coherence.md)
- [ ] TODO [`registry-listing-and-namespace-ownership-proof`](./mcp-server-quality/registry-listing-and-namespace-ownership-proof.ts) — Registry Listing and Namespace Ownership Proof (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/registry-listing-and-namespace-ownership-proof.md)
- [ ] TODO [`tool-self-description-coverage`](./mcp-server-quality/tool-self-description-coverage.ts) — Tool Self-Description Coverage (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/tool-self-description-coverage.md)
- [ ] TODO [`behavior-annotation-coverage-and-claim-consistency`](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.ts) — Behavior Annotation Coverage and Claim Consistency (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md)

## token-economics

- [ ] TODO [`boilerplate-tax-across-the-crawl-unique-tokens-per-fetch`](./token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch.ts) — Boilerplate tax across the crawl (unique tokens per fetch) (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch.md)
- [ ] TODO [`extraction-determinism-multi-extractor-agreement`](./token-economics/extraction-determinism-multi-extractor-agreement.ts) — Extraction determinism (multi-extractor agreement) (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/token-economics/extraction-determinism-multi-extractor-agreement.md)
- [ ] TODO [`markdown-alternate-discoverable-resolvable-faithful-cheaper`](./token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.ts) — Markdown alternate: discoverable, resolvable, faithful, cheaper (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.md)
- [ ] TODO [`json-ld-duplication-mass`](./token-economics/json-ld-duplication-mass.ts) — JSON-LD duplication mass (grade C, informative, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/token-economics/json-ld-duplication-mass.md)

## trust-provenance

- [ ] TODO [`c2pa-manifest-survives-the-delivery-pipeline`](./trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.ts) — C2PA manifest survives the delivery pipeline (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.md)
- [ ] TODO [`c2pa-signer-chains-to-the-live-c2pa-trust-list`](./trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.ts) — C2PA signer chains to the live C2PA Trust List (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md)
- [ ] TODO [`organization-identifier-resolves-in-the-authoritative-regist`](./trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.ts) — Organization identifier resolves in the authoritative registry (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md)
- [ ] TODO [`synthetic-media-disclosure-is-valid-and-self-consistent`](./trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.ts) — Synthetic-media disclosure is valid and self-consistent (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md)
- [ ] TODO [`wikidata-round-trip-entity-verification`](./trust-provenance/wikidata-round-trip-entity-verification.ts) — Wikidata round-trip entity verification (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/wikidata-round-trip-entity-verification.md)
- [ ] TODO [`trust-txt-reciprocity-and-ai-policy-coherence`](./trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.ts) — trust.txt reciprocity and AI-policy coherence (grade C, informative, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md)
