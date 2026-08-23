# Proposed checks — evidence dossiers

36 proposed checks from the 2026-08-20 novel-checks research pass. Each dossier states what the check verifies, the falsifiable mechanism behind it, cited evidence from the [source registry](../sources.json), competitor coverage, and an implementation sketch. Grading rubric: [evidence policy](../POLICY.md).

Seven dossiers left this folder on 2026-08-22 (Plan 5, Task 2): six tool
surveys moved to [../research](../research/README.md) because their verdict is
a market fact identical for every scanned URL, and `ai-crawler-edge-parity`,
which was the same check as `bot-auth-access/ai-crawler-edge-response-parity`
and folded into
[../merged/access-crawl-control/ai-crawler-edge-parity.md](../merged/access-crawl-control/ai-crawler-edge-parity.md).

Dossiers that graduate to a shipped audit move to
[../audits](../audits/README.md) with `status: merged`-style audit frontmatter;
their row leaves the table below and the count above drops by one.

Grades: **A** = documented consumer behavior or ratified standard · **B** = draft standard with adoption, or strong empirical data · **C** = plausible convention, unproven · **D** = speculative.

| Grade | Check | Domain | Uniqueness | Implementation | Scoring tier |
| :---- | :---- | :----- | :--------- | :------------- | :----------- |
| A | [Overlay Interception Hazard](./agent-operability/overlay-interception-hazard.md) | agent-operability | unique | `headless-browser` | scored |
| A | [ACP Endpoint Conformance Probe](./agentic-commerce/acp-endpoint-conformance-probe.md) | agentic-commerce | unique | `static-fetch` | informative (weight 0) |
| B | [Buyable Variant Resolution](./agentic-commerce/buyable-variant-resolution.md) | agentic-commerce | unique | `multi-page` | scored |
| B | [Cart Handoff Reachability](./agentic-commerce/cart-handoff-reachability.md) | agentic-commerce | unique | `multi-page` | scored |
| B | [Offer Truth Consistency](./agentic-commerce/offer-truth-consistency.md) | agentic-commerce | unique | `multi-page` | scored |
| B | [Chunk-Boundary Referent Integrity](./answer-selection-forensics/chunk-boundary-referent-integrity.md) | answer-selection-forensics | unique | `static-fetch` | scored |
| B | [Extractor Survival Recall](./answer-selection-forensics/extractor-survival-recall.md) | answer-selection-forensics | unique | `static-fetch` | scored |
| B | [Section Split-Risk Profile](./answer-selection-forensics/section-split-risk-profile.md) | answer-selection-forensics | unique | `static-fetch` | scored |
| B | [Site-Wide Passage Uniqueness Ratio](./answer-selection-forensics/site-wide-passage-uniqueness-ratio.md) | answer-selection-forensics | partial-overlap | `multi-page` | scored |
| B | [Table Markdown Round-Trip Loss](./answer-selection-forensics/table-markdown-round-trip-loss.md) | answer-selection-forensics | partial-overlap | `static-fetch` | scored |
| B | [AI usage signal coherence across channels](./bot-auth-access/ai-usage-signal-coherence-across-channels.md) | bot-auth-access | unique | `static-fetch` | scored |
| B | [AIPREF Content-Usage declaration validity](./bot-auth-access/aipref-content-usage-declaration-validity.md) | bot-auth-access | unique | `static-fetch` | scored |
| B | [Machine-actionable 402 paid-access response](./bot-auth-access/machine-actionable-402-paid-access-response.md) | bot-auth-access | unique | `static-fetch` | scored |
| B | [RSL licensing terms discoverable and conformant](./bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.md) | bot-auth-access | unique | `static-fetch` | scored |
| B | [Signed-agent (Web Bot Auth) request tolerance](./bot-auth-access/signed-agent-web-bot-auth-request-tolerance.md) | bot-auth-access | unique | `static-fetch` | scored |
| B | [content-signal-coherence](./competitor-gap-verify/content-signal-coherence.md) | competitor-gap-verify | unique | `static-fetch` | scored |
| B | [offer-dom-price-parity](./competitor-gap-verify/offer-dom-price-parity.md) | competitor-gap-verify | unique | `multi-page` | scored |
| B | [Conditional-request support on discovery surfaces](./feeds-indexing/conditional-request-support-on-discovery-surfaces.md) | feeds-indexing | unique | `static-fetch` | scored |
| B | [Feed entry identity and canonical integrity](./feeds-indexing/feed-entry-identity-and-canonical-integrity.md) | feeds-indexing | unique | `multi-page` | scored |
| B | [Root text-file resolution integrity (IndexNow key-file precondition)](./feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.md) | feeds-indexing | unique | `static-fetch` | scored |
| B | [Three-way freshness lag and orphaned fresh content](./feeds-indexing/three-way-freshness-lag-and-orphaned-fresh-content.md) | feeds-indexing | partial-overlap | `multi-page` | scored |
| B | [Origin Validation and CORS Coherence](./mcp-server-quality/origin-validation-and-cors-coherence.md) | mcp-server-quality | unique | `static-fetch` | scored |
| B | [Registry Listing and Namespace Ownership Proof](./mcp-server-quality/registry-listing-and-namespace-ownership-proof.md) | mcp-server-quality | partial-overlap | `multi-page` | scored |
| B | [Tool Self-Description Coverage](./mcp-server-quality/tool-self-description-coverage.md) | mcp-server-quality | partial-overlap | `static-fetch` | scored |
| B | [Extraction determinism (multi-extractor agreement)](./token-economics/extraction-determinism-multi-extractor-agreement.md) | token-economics | unique | `static-fetch` | scored |
| B | [Markdown alternate: discoverable, resolvable, faithful, cheaper](./token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.md) | token-economics | partial-overlap | `static-fetch` | scored |
| B | [C2PA manifest survives the delivery pipeline](./trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.md) | trust-provenance | unique | `static-fetch` | scored |
| B | [C2PA signer chains to the live C2PA Trust List](./trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md) | trust-provenance | unique | `static-fetch` | scored |
| B | [Organization identifier resolves in the authoritative registry](./trust-provenance/organization-identifier-resolves-in-the-authoritative-regist.md) | trust-provenance | unique | `static-fetch` | scored |
| B | [Synthetic-media disclosure is valid and self-consistent](./trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md) | trust-provenance | unique | `static-fetch` | scored |
| B | [Wikidata round-trip entity verification](./trust-provenance/wikidata-round-trip-entity-verification.md) | trust-provenance | unique | `static-fetch` | scored |
| C | [Question-Heading Answer Span Alignment](./answer-selection-forensics/question-heading-answer-span-alignment.md) | answer-selection-forensics | unique | `llm-assisted` | informative (weight 0) |
| C | [WebSub hub advertisement and self-link correctness](./feeds-indexing/websub-hub-advertisement-and-self-link-correctness.md) | feeds-indexing | unique | `static-fetch` | informative (weight 0) |
| C | [Behavior Annotation Coverage and Claim Consistency](./mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md) | mcp-server-quality | unique | `llm-assisted` | informative (weight 0) |
| C | [JSON-LD duplication mass](./token-economics/json-ld-duplication-mass.md) | token-economics | unique | `static-fetch` | informative (weight 0) |
| C | [trust.txt reciprocity and AI-policy coherence](./trust-provenance/trust-txt-reciprocity-and-ai-policy-coherence.md) | trust-provenance | unique | `multi-page` | informative (weight 0) |
