# Proposed audits — TODO stubs

16 stub files for the proposed checks from the 2026-08-20 research pass. Every stub compiles, is **not** registered in any category index, and returns `notApplicable` until implemented. Each file's header carries its implementation sketch; full proof lives in [docs/evidence/proposals](../../../../../docs/evidence/proposals/README.md).

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

- [ ] TODO [`question-heading-answer-span-alignment`](./answer-selection-forensics/question-heading-answer-span-alignment.ts) — Question-Heading Answer Span Alignment (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md)

## bot-auth-access


## competitor-gap-verify

- [ ] TODO [`offer-dom-price-parity`](./competitor-gap-verify/offer-dom-price-parity.ts) — offer-dom-price-parity (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/competitor-gap-verify/offer-dom-price-parity.md)

## feeds-indexing


## injection-safety


## mcp-server-quality

- [ ] TODO [`origin-validation-and-cors-coherence`](./mcp-server-quality/origin-validation-and-cors-coherence.ts) — Origin Validation and CORS Coherence (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/origin-validation-and-cors-coherence.md)
- [ ] TODO [`registry-listing-and-namespace-ownership-proof`](./mcp-server-quality/registry-listing-and-namespace-ownership-proof.ts) — Registry Listing and Namespace Ownership Proof (grade B, scored, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/registry-listing-and-namespace-ownership-proof.md)
- [ ] TODO [`tool-self-description-coverage`](./mcp-server-quality/tool-self-description-coverage.ts) — Tool Self-Description Coverage (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/tool-self-description-coverage.md)
- [ ] TODO [`behavior-annotation-coverage-and-claim-consistency`](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.ts) — Behavior Annotation Coverage and Claim Consistency (grade C, informative, `llm-assisted`) · [dossier](../../../../../docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md)

## token-economics


## trust-provenance

- [ ] TODO [`c2pa-signer-chains-to-the-live-c2pa-trust-list`](./trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.ts) — C2PA signer chains to the live C2PA Trust List (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md)
- [ ] TODO [`organization-identifier-resolves-in-the-authoritative-regist`](./trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.ts) — Organization identifier resolves in the authoritative registry (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md)
- [ ] TODO [`synthetic-media-disclosure-is-valid-and-self-consistent`](./trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.ts) — Synthetic-media disclosure is valid and self-consistent (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md)
- [ ] TODO [`wikidata-round-trip-entity-verification`](./trust-provenance/wikidata-round-trip-entity-verification.ts) — Wikidata round-trip entity verification (grade B, scored, `static-fetch`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/wikidata-round-trip-entity-verification.md)
- [ ] TODO [`trust-txt-reciprocity-and-ai-policy-coherence`](./trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.ts) — trust.txt reciprocity and AI-policy coherence (grade C, informative, `multi-page`) · [dossier](../../../../../docs/evidence/proposals/trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md)
