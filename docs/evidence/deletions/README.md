# Deletion research — final dispositions

32 audits marked for deletion by the 2026-08-20 quality review were re-researched on 2026-08-21 by an adversarial 8-agent workflow (each researcher's task: **redeem** the audit by finding a named consumer with grade A/B evidence). The user reviewed and accepted all 32 verdicts on 2026-08-21, with disposition set by evidence grade:

- **Grade D (18) → graceful sunset.** Condensed public rationale: [NOT-A-FACTOR.md](../NOT-A-FACTOR.md). Deprecation follows the [evidence policy](../POLICY.md): one minor release informative (weight 0) with notice, removed next major. Dossiers stay published as the record.
- **Grade C (5) → kept as informative (weight 0)**, documented.
- **Grade A/B (9) → kept, rewrite required** per dossier (the research overturned the delete verdict — most notably the `ai-catalog` family, saved by the ARD draft spec and Hugging Face's `hf-discover` client).

| Disposition | Grade | Audit | Rationale (first sentence) |
| :---------- | :---- | :---- | :------------------------- |
| 🌇 sunset | D | [accessibility/skip-nav](./accessibility/skip-nav.md) | Grade D |
| 🌇 sunset | D | [agent-tools/ai-plugin-json](./agent-tools/ai-plugin-json.md) | Grade D: the sole documented consumer (ChatGPT plugins) was discontinued, OpenAI archived its official quickstart with an explicit 'supersed |
| 🌇 sunset | D | [agent-tools/data-action-ctas](./agent-tools/data-action-ctas.md) | Grade D: speculative attribute with no documented consumer at any vendor, plus active namespace collision with Stimulus/Hotwire that makes t |
| 🌇 sunset | D | [agent-tools/openapi-ai-instructions](./agent-tools/openapi-ai-instructions.md) | Grade D: an unregistered, vendor-less extension key with no documented consumer and adoption that is essentially self-referential (a single  |
| 🌇 sunset | D | [agent-tools/webmcp-action-coverage](./agent-tools/webmcp-action-coverage.md) | Grade D |
| 🌇 sunset | D | [content-discoverability/navigation-json](./content-discoverability/navigation-json.md) | Grade D |
| 🌇 sunset | D | [generative-engine/pagination-links](./generative-engine/pagination-links.md) | Grade D |
| 🌇 sunset | D | [meta-tags/ai-instructions](./meta-tags/ai-instructions.md) | Grade D: no spec defines it, no vendor reads it, the one standards body working on the problem explicitly chose HTTP headers and robots.txt  |
| 🌇 sunset | D | [meta-tags/llms-full-txt-link](./meta-tags/llms-full-txt-link.md) | Grade D |
| 🌇 sunset | D | [meta-tags/mcp-discovery-link](./meta-tags/mcp-discovery-link.md) | Grade D for the signal as implemented |
| 🌇 sunset | D | [semantic-html/address-element](./semantic-html/address-element.md) | Grade D |
| 🌇 sunset | D | [semantic-html/decorative-images](./semantic-html/decorative-images.md) | Grade D |
| 🌇 sunset | D | [structured-data/action-schema](./structured-data/action-schema.md) | Grade D |
| 🌇 sunset | D | [structured-data/potential-action](./structured-data/potential-action.md) | Grade D |
| 🌇 sunset | D | [technical-readiness/framework-detection](./technical-readiness/framework-detection.md) | Grade D |
| 🌇 sunset | D | [technical-readiness/permissions-policy](./technical-readiness/permissions-policy.md) | Grade D |
| 🌇 sunset | D | [technical-readiness/preconnect-hints](./technical-readiness/preconnect-hints.md) | Grade D |
| 🌇 sunset | D | [technical-readiness/referrer-policy](./technical-readiness/referrer-policy.md) | Grade D |
| ℹ️ informative (weight 0) | C | [agent-tools/agents-json](./agent-tools/agents-json.md) | Grade C (a real community convention with no documented consumer), and the rubric permits 'dead-but-informative-candidate' for grade C only  |
| ℹ️ informative (weight 0) | C | [content-discoverability/llms-full-txt](./content-discoverability/llms-full-txt.md) | Grade C — a community convention with no documented consumer — but the adoption is genuinely wide and concentrated among the AI vendors them |
| ℹ️ informative (weight 0) | C | [generative-engine/about-credentials](./generative-engine/about-credentials.md) | The keyword heuristic is grade D on its own — no documented consumer, and Google's rater guidelines specifically instruct evaluators NOT to  |
| ℹ️ informative (weight 0) | C | [structured-data/howto-schema](./structured-data/howto-schema.md) | Grade C: the ingestion-quality mechanism is plausible and the type is genuinely widely deployed (100K-1M domains, still first-class in the s |
| ℹ️ informative (weight 0) | C | [technical-readiness/security-txt](./technical-readiness/security-txt.md) | Grade C, and the adoption test is met — but only for the file, never for the claim |
| ✅ kept + rewrite | A | [agent-tools/ai-catalog-exists](./agent-tools/ai-catalog-exists.md) | Grade A evidence: a named vendor tool (Hugging Face hf-discover) documents and implements fetching exactly https://{domain}/.well-known/ai-c |
| ✅ kept + rewrite | B | [agent-tools/ai-catalog-metadata](./agent-tools/ai-catalog-metadata.md) | The underlying mechanism is real and consumer-backed (hf-discover's ranking is driven entirely by manifest metadata richness), which is grad |
| ✅ kept + rewrite | B | [agent-tools/ai-catalog-urls](./agent-tools/ai-catalog-urls.md) | Grade B: the checked property (liveness of manifest-listed endpoints) is a real field in a real draft spec that a named Hugging Face client  |
| ✅ kept + rewrite | A | [agent-tools/webmcp-declarative-forms](./agent-tools/webmcp-declarative-forms.md) | Grade A |
| ✅ kept + rewrite | A | [crawler-permissions/sensitive-paths](./crawler-permissions/sensitive-paths.md) | Grade A on the mechanism: named AI crawlers are documented to honor path-level Disallow, with literal directory examples from Apple (Applebo |
| ✅ kept + rewrite | B | [generative-engine/trust-signals](./generative-engine/trust-signals.md) | Grade B: there is strong, quantified, multi-model empirical data that trust and social-proof cues in retrieved page text change which source |
| ✅ kept + rewrite | B | [meta-tags/ai-catalog-link](./meta-tags/ai-catalog-link.md) | Grade B: the mechanism is written into two draft specs (ARD §6.1 and the LF Agent Card WG consuming guide) and is genuinely deployed in prod |
| ✅ kept + rewrite | B | [semantic-html/aside-element](./semantic-html/aside-element.md) | Grade B => redeemable, and the audit's stated mechanism is essentially verbatim correct |
| ✅ kept + rewrite | A | [structured-data/speakable-schema](./structured-data/speakable-schema.md) | Grade A: a live vendor doc names a specific agent (Google Assistant) that reads the signal, and the feature is still listed in Google's curr |
