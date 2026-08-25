# Sunset — removed audits and the proof they were not a factor

26 audits shipped in Agent Lighthouse v1 were **removed** in the v2 major release. Each one claimed a signal that the 2026-08-21 adversarial redemption research could not redeem: no named consumer reads it, or the only consumer publicly stopped. Under the [evidence policy](../policy.md) a grade-D audit may carry no score weight, so rather than keep them running as informative noise they were deleted outright.

This folder is the permanent record of that decision, so the checks are not reinvented later:

- [not-a-factor.md](./not-a-factor.md) — the condensed public rationale: per audit, the steelmanned claim, why it is not a factor, the verdict, and the key sources.
- One full research dossier per audit (steelmanned claim, search trail, every source), linked below.

Consumers that keyed on these check ids should read [`packages/core/migration-map.json`](../../../packages/core/migration-map.json): every entry carries `status: "removed"` and a link to its rationale anchor.

| v1 id | Audit | Dossier |
| :---- | :---- | :------ |
| 1.18 | `content-discoverability/mobile-friendly` | [dossier](./content-discoverability/mobile-friendly.md) |
| 1.21 | `content-discoverability/navigation-json` | [dossier](./content-discoverability/navigation-json.md) |
| 1.23 | `content-discoverability/commerce-links` | [dossier](./content-discoverability/commerce-links.md) |
| 3.10 | `structured-data/potential-action` | [dossier](./structured-data/potential-action.md) |
| 3.16 | `structured-data/action-schema` | [dossier](./structured-data/action-schema.md) |
| 4.12 | `meta-tags/llms-full-txt-link` | [dossier](./meta-tags/llms-full-txt-link.md) |
| 4.14 | `meta-tags/ai-instructions` | [dossier](./meta-tags/ai-instructions.md) |
| 4.17 | `meta-tags/mcp-discovery-link` | [dossier](./meta-tags/mcp-discovery-link.md) |
| 5.4 | `agent-tools/openapi-ai-instructions` | [dossier](./agent-tools/openapi-ai-instructions.md) |
| 5.11 | `agent-tools/ai-plugin-json` | [dossier](./agent-tools/ai-plugin-json.md) |
| 5.17 | `agent-tools/data-action-ctas` | [dossier](./agent-tools/data-action-ctas.md) |
| 5.25 | `agent-tools/webmcp-action-coverage` | [dossier](./agent-tools/webmcp-action-coverage.md) |
| 6.12 | `semantic-html/address-element` | [dossier](./semantic-html/address-element.md) |
| 6.16 | `semantic-html/decorative-images` | [dossier](./semantic-html/decorative-images.md) |
| 7.1 | `accessibility/skip-nav` | [dossier](./accessibility/skip-nav.md) |
| 7.22 | `accessibility/marquee` | [dossier](./accessibility/marquee.md) |
| 8.5 | `technical-readiness/referrer-policy` | [dossier](./technical-readiness/referrer-policy.md) |
| 8.6 | `technical-readiness/permissions-policy` | [dossier](./technical-readiness/permissions-policy.md) |
| 8.14 | `technical-readiness/no-render-blocking` | [dossier](./technical-readiness/no-render-blocking.md) |
| 8.15 | `technical-readiness/image-dimensions` | [dossier](./technical-readiness/image-dimensions.md) |
| 8.16 | `technical-readiness/lcp-not-lazy` | [dossier](./technical-readiness/lcp-not-lazy.md) |
| 8.17 | `technical-readiness/preconnect-hints` | [dossier](./technical-readiness/preconnect-hints.md) |
| 8.19 | `technical-readiness/privacy-policy` | [dossier](./technical-readiness/privacy-policy.md) |
| 8.20 | `technical-readiness/terms-of-service` | [dossier](./technical-readiness/terms-of-service.md) |
| 8.21 | `technical-readiness/framework-detection` | [dossier](./technical-readiness/framework-detection.md) |
| 10.12 | `generative-engine/pagination-links` | [dossier](./generative-engine/pagination-links.md) |

The other 14 audits from the same delete-candidate batch were **not** sunset — nine were redeemed and kept, five stayed as informative. Their research lives in [deletions/](../deletions/README.md).
