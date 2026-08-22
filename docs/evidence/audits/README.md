# Audit dossiers — all v1 audits

One dossier per audit: what it checks, the 2026-08-20 code-review findings, graded evidence signals with sources, and current disposition. Companion documents: [evidence policy](../POLICY.md) · [deletion research](../deletions/README.md) · [sunset audits](../sunset/README.md) · [proposed new checks](../proposals/README.md).

207 audits. Dispositions marked "pending triage" await the merge/fix review; "approved 2026-08-21" reflect the accepted deletion-research verdicts.

| ID | Audit | Category | Review verdict | Evidence grade | Disposition |
| :- | :---- | :------- | :------------- | :------------- | :---------- |
| 7.1 | [skip-nav](./accessibility/skip-nav.md) | accessibility | delete | D | sunset (approved 2026-08-21) |
| 7.2 | [aria-landmarks](./operability-safety/aria-landmarks.md) | accessibility | fix | A | keep — fix required |
| 7.3 | [nav-aria-label](./operability-safety/nav-aria-label.md) | accessibility | merge | A | merge (approved 2026-08-21) |
| 7.4 | [Landmarks are uniquely identifiable](./operability-safety/landmark-unique.md) | accessibility | fix | A | keep — fix required |
| 7.5 | [Form inputs have associated labels](./operability-safety/label.md) | accessibility | keep | A | keep |
| 7.6 | [form-error-messages](./operability-safety/form-error-messages.md) | accessibility | delete | A | proposed: redeem as scored (pending triage) |
| 7.7 | [Buttons and links have accessible names](./operability-safety/accessible-names.md) | accessibility | keep | A | keep |
| 7.9 | [Dialogs have accessible names](./operability-safety/dialog-name.md) | accessibility | fix | — | keep — fix required |
| 7.10 | [Page exposed to the accessibility tree](./operability-safety/aria-hidden-body.md) | accessibility | fix | — | keep — fix required |
| 7.11 | [Valid ARIA roles](./operability-safety/aria-roles.md) | accessibility | fix | A | keep — fix required |
| 7.12 | [Valid ARIA attributes](./operability-safety/aria-attributes.md) | accessibility | keep | — | keep |
| 7.13 | [Complete ARIA relationships](./operability-safety/aria-relationships.md) | accessibility | fix | A | keep — fix required |
| 7.14 | [Unique IDs for ARIA references](./operability-safety/duplicate-id.md) | accessibility | fix | — | keep — fix required |
| 7.15 | [Form fields use valid autocomplete tokens](./operability-safety/autocomplete.md) | accessibility | fix | A | keep — fix required |
| 7.16 | [No nested interactive controls](./operability-safety/nested-interactive.md) | accessibility | keep | A | keep |
| 7.17 | [Data tables have header associations](./operability-safety/table-headers.md) | accessibility | keep | B | keep |
| 7.18 | [Page has a non-empty <title>](./operability-safety/document-title.md) | accessibility | keep | — | keep |
| 7.19 | [Frames are titled](./operability-safety/frame-title.md) | accessibility | fix | — | keep — fix required |
| 7.20 | [No time-based auto-refresh/redirect](./operability-safety/meta-refresh.md) | accessibility | keep | — | keep |
| 7.21 | [No positive tabindex (logical focus order)](./operability-safety/tabindex.md) | accessibility | fix | — | keep — fix required |
| 7.22 | [No deprecated presentational elements](../sunset/accessibility/marquee.md) | accessibility | delete | — | sunset (2026-08-21) |
| 7.23 | [No presentation-role conflicts](./operability-safety/presentation-conflict.md) | accessibility | fix | A | keep — fix required |
| 5.1 | [openapi-exists](./agent-interfaces/openapi-exists.md) | agent-tools | fix | — | keep — fix required |
| 5.2 | [openapi-endpoints](./agent-interfaces/openapi-endpoints.md) | agent-tools | fix | — | keep — fix required |
| 5.3 | [openapi-operation-ids](./agent-interfaces/openapi-operation-ids.md) | agent-tools | fix | — | keep — fix required |
| 5.4 | [openapi-ai-instructions](./agent-tools/openapi-ai-instructions.md) | agent-tools | delete | D | sunset (approved 2026-08-21) |
| 5.5 | [openapi-servers](./agent-interfaces/openapi-servers.md) | agent-tools | fix | — | keep — fix required |
| 5.6 | [openapi-schemas](./agent-interfaces/openapi-schemas.md) | agent-tools | fix | — | keep — fix required |
| 5.7 | [ai-catalog-exists](./agent-interfaces/ai-catalog-exists.md) | agent-tools | delete | A | kept — rewrite required (approved 2026-08-21) |
| 5.8 | [ai-catalog-metadata](./agent-interfaces/ai-catalog-metadata.md) | agent-tools | delete | B | kept — rewrite required (approved 2026-08-21) |
| 5.9 | [ai-catalog-urls](./agent-interfaces/ai-catalog-urls.md) | agent-tools | delete | B | kept — rewrite required (approved 2026-08-21) |
| 5.10 | [agents-json](./agent-interfaces/agents-json.md) | agent-tools | delete | C | informative, weight 0 (approved 2026-08-21) |
| 5.11 | [ai-plugin-json](./agent-tools/ai-plugin-json.md) | agent-tools | delete | D | sunset (approved 2026-08-21) |
| 5.12 | [mcp-discovery](./agent-interfaces/mcp-discovery.md) | agent-tools | fix | A | keep — fix required |
| 5.13 | [mcp-endpoint](./agent-interfaces/mcp-endpoint.md) | agent-tools | fix | C | keep — fix required |
| 5.14 | [mcp-capabilities](./agent-interfaces/mcp-capabilities.md) | agent-tools | merge | — | merge (approved 2026-08-21) |
| 5.15 | [contact-form](./operability-safety/contact-form.md) | agent-tools | fix | C | keep — fix required |
| 5.16 | [search-endpoint](./agent-interfaces/search-endpoint.md) | agent-tools | fix | — | keep — fix required |
| 5.17 | [data-action-ctas](./agent-tools/data-action-ctas.md) | agent-tools | delete | D | sunset (approved 2026-08-21) |
| 5.18 | [no-blocking-captcha](./operability-safety/no-blocking-captcha.md) | agent-tools | fix | — | keep — fix required |
| 5.19 | [forms-no-js](./operability-safety/forms-no-js.md) | agent-tools | fix | — | keep — fix required |
| 5.20 | [webmcp-registered-tools](./agent-interfaces/webmcp-registered-tools.md) | agent-tools | delete | A | proposed: redeem as experimental (pending triage) |
| 5.21 | [webmcp-declarative-forms](./agent-interfaces/webmcp-declarative-forms.md) | agent-tools | delete | A | kept — rewrite required (approved 2026-08-21) |
| 5.22 | [webmcp-input-quality](./operability-safety/webmcp-input-quality.md) | agent-tools | merge | — | merge (approved 2026-08-21) |
| 5.23 | [webmcp-tool-naming](./agent-interfaces/webmcp-tool-naming.md) | agent-tools | merge | — | merge (approved 2026-08-21) |
| 5.24 | [webmcp-tool-annotations](./agent-interfaces/webmcp-tool-annotations.md) | agent-tools | merge | — | merge (approved 2026-08-21) |
| 5.25 | [webmcp-action-coverage](./agent-tools/webmcp-action-coverage.md) | agent-tools | delete | D | sunset (approved 2026-08-21) |
| 5.26 | [openapi-description-quality](./agent-interfaces/openapi-description-quality.md) | agent-tools | fix | — | keep — fix required |
| 5.27 | [form-actionability](./operability-safety/form-actionability.md) | agent-tools | keep | — | keep |
| 9.1 | [faq-sections](./answer-readiness/faq-sections.md) | answer-engine | fix | — | keep — fix required |
| 9.2 | [question-headings](./answer-readiness/question-headings.md) | answer-engine | fix | C | keep — fix required |
| 9.3 | [first-paragraph-answers](./answer-readiness/first-paragraph-answers.md) | answer-engine | fix | — | keep — fix required |
| 9.4 | [direct-definitions](./answer-readiness/direct-definitions.md) | answer-engine | delete | — | proposed: redeem as scored (pending triage) |
| 9.5 | [comparison-tables](./answer-readiness/comparison-tables.md) | answer-engine | fix | C | keep — fix required |
| 9.6 | [numbered-steps](./answer-readiness/numbered-steps.md) | answer-engine | fix | — | keep — fix required |
| 9.7 | [specific-numbers](./answer-readiness/specific-numbers.md) | answer-engine | fix | — | keep — fix required |
| 9.8 | [dates-on-content](./answer-readiness/dates-on-content.md) | answer-engine | fix | — | keep — fix required |
| 9.9 | [content-without-clickthrough](./answer-readiness/content-without-clickthrough.md) | answer-engine | fix | — | keep — fix required |
| 9.10 | [last-updated-indicator](./answer-readiness/last-updated-indicator.md) | answer-engine | merge | — | merge (approved 2026-08-21) |
| 9.11 | [meta-description-aeo](./answer-readiness/meta-description-aeo.md) | answer-engine | delete | C | proposed: redeem as scored (pending triage) |
| 1.1 | [llms-txt-exists](./machine-discovery/llms-txt-exists.md) | content-discoverability | fix | A | keep — fix required |
| 1.2 | [llms-txt-blockquote](../merged/machine-discovery/llms-txt-blockquote.md) | content-discoverability | merge | — | merged into [machine-discovery/llms-txt-structure](./machine-discovery/llms-txt-structure.md) (2026-08-22) |
| 1.3 | [llms-txt-sections](../merged/machine-discovery/llms-txt-sections.md) | content-discoverability | merge | — | merged into [machine-discovery/llms-txt-structure](./machine-discovery/llms-txt-structure.md) (2026-08-22) |
| 1.4 | [llms-txt-link-descriptions](./machine-discovery/llms-txt-link-descriptions.md) | content-discoverability | fix | — | keep — fix required |
| 1.5 | [llms-txt-links-valid](./machine-discovery/llms-txt-links-valid.md) | content-discoverability | fix | B | keep — fix required |
| 1.6 | [llms-full-txt](./machine-discovery/llms-full-txt.md) | content-discoverability | fix | C | informative, weight 0 (approved 2026-08-21) |
| 1.7 | [sitemap-exists](./machine-discovery/sitemap-exists.md) | content-discoverability | fix | A | keep — fix required |
| 1.8 | [sitemap-key-pages](./machine-discovery/discovery-index-coverage.md) | content-discoverability | fix | B | keep — fix required |
| 1.9 | [sitemap-absolute-urls](./machine-discovery/sitemap-absolute-urls.md) | content-discoverability | fix | B | keep — fix required |
| 1.10 | [sitemap-lastmod](./machine-discovery/sitemap-lastmod.md) | content-discoverability | fix | A | keep — fix required |
| 1.11 | [rss-feed](./machine-discovery/rss-feed.md) | content-discoverability | fix | B | keep — fix required |
| 1.12 | [rss-feed-content](./machine-discovery/rss-feed-content.md) | content-discoverability | fix | — | keep — fix required |
| 1.13 | [no-noindex](./access-crawl-control/no-noindex.md) | content-discoverability | fix | — | keep — fix required |
| 1.14 | [no-nofollow](./access-crawl-control/no-nofollow.md) | content-discoverability | fix | A | keep — fix required |
| 1.15 | [internal-linking](./machine-discovery/in-content-links.md) | content-discoverability | fix | A | keep — fix required |
| 1.16 | [no-redirect-chains](./access-crawl-control/no-redirect-chains.md) | content-discoverability | fix | — | keep — fix required |
| 1.17 | [canonical-links](./access-crawl-control/canonical.md) | content-discoverability | fix | — | keep — fix required |
| 1.18 | [mobile-friendly](../sunset/content-discoverability/mobile-friendly.md) | content-discoverability | delete | — | sunset (2026-08-21) |
| 1.19 | [fast-page-load](./content-extraction/server-responsiveness.md) | content-discoverability | fix | B | keep — fix required |
| 1.20 | [no-broken-links](./machine-discovery/no-broken-links.md) | content-discoverability | fix | A | keep — fix required |
| 1.21 | [navigation-json](./content-discoverability/navigation-json.md) | content-discoverability | delete | D | sunset (approved 2026-08-21) |
| 1.22 | [no-orphan-pages](../merged/machine-discovery/no-orphan-pages.md) | content-discoverability | merge | A | merged into [machine-discovery/discovery-index-coverage](./machine-discovery/discovery-index-coverage.md) (2026-08-22) |
| 1.23 | [commerce-links](../sunset/content-discoverability/commerce-links.md) | content-discoverability | fix | D | sunset (2026-08-21) |
| 2.1 | [gptbot](./access-crawl-control/gptbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.2 | [google-extended](./access-crawl-control/google-extended.md) | crawler-permissions | fix | A | keep — fix required |
| 2.3 | [anthropic](./access-crawl-control/anthropic-ai.md) | crawler-permissions | fix | A | keep — fix required |
| 2.4 | [perplexitybot](./access-crawl-control/perplexitybot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.5 | [applebot-extended](./access-crawl-control/applebot-extended.md) | crawler-permissions | fix | A | keep — fix required |
| 2.6 | [ccbot](./access-crawl-control/ccbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.7 | [meta-external-agent](./access-crawl-control/meta-external-agent.md) | crawler-permissions | fix | A | keep — fix required |
| 2.8 | [amazonbot](./access-crawl-control/amazonbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.9 | [bytespider](../merged/access-crawl-control/bytespider.md) | crawler-permissions | delete | C | merged into [access-crawl-control/ai-bot-directives](./access-crawl-control/ai-bot-directives.md) (2026-08-22) |
| 2.10 | [cohere-ai](../merged/access-crawl-control/cohere-ai.md) | crawler-permissions | delete | C | merged into [access-crawl-control/ai-bot-directives](./access-crawl-control/ai-bot-directives.md) (2026-08-22) |
| 2.11 | [youbot](../merged/access-crawl-control/youbot.md) | crawler-permissions | delete | A | merged into [access-crawl-control/ai-bot-directives](./access-crawl-control/ai-bot-directives.md) (2026-08-22) |
| 2.12 | [diffbot](../merged/access-crawl-control/diffbot.md) | crawler-permissions | delete | C | merged into [access-crawl-control/ai-bot-directives](./access-crawl-control/ai-bot-directives.md) (2026-08-22) |
| 2.13 | [ai2bot](../merged/access-crawl-control/ai2bot.md) | crawler-permissions | delete | B | merged into [access-crawl-control/ai-bot-directives](./access-crawl-control/ai-bot-directives.md) (2026-08-22) |
| 2.14 | [chatgpt-user](./access-crawl-control/chatgpt-user.md) | crawler-permissions | fix | A | keep — fix required |
| 2.15 | [claude-user](./access-crawl-control/claude-user.md) | crawler-permissions | fix | A | keep — fix required |
| 2.16 | [oai-searchbot](./access-crawl-control/oai-searchbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.17 | [meta-external-fetcher](./access-crawl-control/meta-external-fetcher.md) | crawler-permissions | fix | A | keep — fix required |
| 2.18 | [bravebot](./access-crawl-control/bravebot.md) | crawler-permissions | fix | C | keep — fix required |
| 2.19 | [duckassistbot](./access-crawl-control/duckassistbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.20 | [mistralai-user](./access-crawl-control/mistralai-user.md) | crawler-permissions | fix | A | keep — fix required |
| 2.21 | [claude-searchbot](./access-crawl-control/claude-searchbot.md) | crawler-permissions | fix | A | keep — fix required |
| 2.22 | [no-blanket-block](./access-crawl-control/no-blanket-block.md) | crawler-permissions | fix | B | keep — fix required |
| 2.23 | [sensitive-paths](./access-crawl-control/sensitive-paths.md) | crawler-permissions | delete | A | kept — rewrite required (approved 2026-08-21) |
| 2.24 | [crawl-delay](./access-crawl-control/crawl-delay.md) | crawler-permissions | fix | C | keep — fix required |
| 2.25 | [meta-robots-not-blocking](./access-crawl-control/robots-directives.md) | crawler-permissions | fix | — | keep — fix required |
| 2.26 | [no-bot-detection](./access-crawl-control/no-bot-detection.md) | crawler-permissions | fix | — | keep — fix required |
| 2.27 | [tdm-rep](./access-crawl-control/tdm-rep.md) | crawler-permissions | delete | — | proposed: redeem as experimental (pending triage) |
| 2.28 | [agent-governance](./access-crawl-control/agent-governance.md) | crawler-permissions | fix | — | keep — fix required |
| 10.1 | [named-author](./answer-readiness/named-author.md) | generative-engine | fix | — | keep — fix required |
| 10.2 | [author-same-as](./answer-readiness/author-same-as.md) | generative-engine | fix | C | keep — fix required |
| 10.3 | [author-page](./answer-readiness/author-page.md) | generative-engine | fix | C | keep — fix required |
| 10.4 | [about-credentials](./answer-readiness/about-credentials.md) | generative-engine | delete | C | informative, weight 0 (approved 2026-08-21) |
| 10.5 | [external-citations](./answer-readiness/external-citations.md) | generative-engine | fix | — | keep — fix required |
| 10.6 | [brand-name](./answer-readiness/brand-name.md) | generative-engine | fix | C | keep — fix required |
| 10.7 | [trust-signals](./answer-readiness/trust-signals.md) | generative-engine | delete | B | kept — rewrite required (approved 2026-08-21) |
| 10.8 | [review-signals](./answer-readiness/review-signals.md) | generative-engine | fix | — | keep — fix required |
| 10.9 | [publication-date](./answer-readiness/publication-date.md) | generative-engine | keep | — | keep |
| 10.10 | [last-modified-schema](./answer-readiness/last-modified-schema.md) | generative-engine | fix | B | keep — fix required |
| 10.11 | [internal-cross-linking](../merged/machine-discovery/internal-cross-linking.md) | generative-engine | fix | B | merged into [machine-discovery/in-content-links](./machine-discovery/in-content-links.md) (2026-08-22) |
| 10.12 | [pagination-links](./generative-engine/pagination-links.md) | generative-engine | delete | D | sunset (approved 2026-08-21) |
| 10.13 | [unique-data](./answer-readiness/unique-data.md) | generative-engine | fix | — | keep — fix required |
| 10.14 | [blockquote-usage](./answer-readiness/blockquote-usage.md) | generative-engine | merge | B | merge (approved 2026-08-21) |
| 10.15 | [descriptive-urls](./answer-readiness/descriptive-urls.md) | generative-engine | fix | C | keep — fix required |
| 4.1 | [meta-description](./answer-readiness/meta-description.md) | meta-tags | fix | — | keep — fix required |
| 4.2 | [meta-author](./answer-readiness/meta-author.md) | meta-tags | fix | — | keep — fix required |
| 4.3 | [canonical-url](./access-crawl-control/canonical-url.md) | meta-tags | fix | B | keep — fix required |
| 4.4 | [language-attribute](./content-extraction/language-attribute.md) | meta-tags | fix | — | keep — fix required |
| 4.5 | [unique-meta](./answer-readiness/unique-meta.md) | meta-tags | fix | — | keep — fix required |
| 4.6 | [core-open-graph](./answer-readiness/core-open-graph.md) | meta-tags | fix | — | keep — fix required |
| 4.7 | [og-type](./answer-readiness/og-type.md) | meta-tags | fix | — | keep — fix required |
| 4.8 | [og-site-name](./answer-readiness/og-site-name.md) | meta-tags | merge | A | merge (approved 2026-08-21) |
| 4.9 | [og-image-alt](./answer-readiness/og-image-alt.md) | meta-tags | fix | C | keep — fix required |
| 4.10 | [twitter-card](./answer-readiness/twitter-card.md) | meta-tags | delete | C | proposed: redeem as informative (pending triage) |
| 4.11 | [llms-txt-link](../merged/machine-discovery/llms-txt-link.md) | meta-tags | fix | C | merged into [machine-discovery/llms-txt-exists](./machine-discovery/llms-txt-exists.md) (2026-08-22) |
| 4.12 | [llms-full-txt-link](./meta-tags/llms-full-txt-link.md) | meta-tags | merge | D | sunset (approved 2026-08-21) |
| 4.13 | [ai-content-declaration](./access-crawl-control/ai-content-declaration.md) | meta-tags | delete | D | proposed: redeem as experimental (pending triage) |
| 4.14 | [ai-instructions](./meta-tags/ai-instructions.md) | meta-tags | delete | D | sunset (approved 2026-08-21) |
| 4.15 | [markdown-alternate](./content-extraction/markdown-alternate.md) | meta-tags | fix | A | keep — fix required |
| 4.16 | [rss-feed-link](../merged/machine-discovery/rss-feed-link.md) | meta-tags | fix | C | merged into [machine-discovery/rss-feed](./machine-discovery/rss-feed.md) (2026-08-22) |
| 4.17 | [mcp-discovery-link](./meta-tags/mcp-discovery-link.md) | meta-tags | delete | D | sunset (approved 2026-08-21) |
| 4.18 | [openapi-link](./agent-interfaces/openapi-link.md) | meta-tags | delete | B | proposed: redeem as scored (pending triage) |
| 4.19 | [ai-catalog-link](./agent-interfaces/ai-catalog-link.md) | meta-tags | delete | B | kept — rewrite required (approved 2026-08-21) |
| 4.20 | [meta-robots](./access-crawl-control/meta-robots.md) | meta-tags | fix | A | keep — fix required |
| 6.1 | [single-h1](./content-extraction/single-h1.md) | semantic-html | fix | B | keep — fix required |
| 6.2 | [sequential-headings](./content-extraction/sequential-headings.md) | semantic-html | fix | B | keep — fix required |
| 6.3 | [main-element](./content-extraction/main-element.md) | semantic-html | fix | A | keep — fix required |
| 6.4 | [article-element](./content-extraction/article-element.md) | semantic-html | fix | A | keep — fix required |
| 6.5 | [header-footer](./content-extraction/header-footer.md) | semantic-html | fix | A | keep — fix required |
| 6.6 | [aside-element](./content-extraction/aside-element.md) | semantic-html | delete | B | kept — rewrite required (approved 2026-08-21) |
| 6.7 | [section-headings](./content-extraction/section-headings.md) | semantic-html | fix | B | keep — fix required |
| 6.8 | [semantic-lists](./content-extraction/semantic-lists.md) | semantic-html | fix | B | keep — fix required |
| 6.9 | [data-tables](./content-extraction/data-tables.md) | semantic-html | fix | B | keep — fix required |
| 6.10 | [code-language](./content-extraction/code-language.md) | semantic-html | fix | — | keep — fix required |
| 6.11 | [time-element](./content-extraction/time-element.md) | semantic-html | fix | C | keep — fix required |
| 6.12 | [address-element](./semantic-html/address-element.md) | semantic-html | delete | D | sunset (approved 2026-08-21) |
| 6.13 | [definition-elements](./content-extraction/definition-elements.md) | semantic-html | merge | B | merge (approved 2026-08-21) |
| 6.14 | [content-depth](./content-extraction/content-depth.md) | semantic-html | fix | B | keep — fix required |
| 6.15 | [image-alt-text](./content-extraction/image-alt-text.md) | semantic-html | fix | A | keep — fix required |
| 6.16 | [decorative-images](./semantic-html/decorative-images.md) | semantic-html | delete | D | sunset (approved 2026-08-21) |
| 6.17 | [figure-figcaption](./content-extraction/figure-figcaption.md) | semantic-html | fix | C | keep — fix required |
| 6.18 | [svg-bloat](./content-extraction/svg-bloat.md) | semantic-html | fix | B | keep — fix required |
| 6.19 | [token-ratio](./content-extraction/token-ratio.md) | semantic-html | fix | B | keep — fix required |
| 6.20 | [fake-headings](./content-extraction/fake-headings.md) | semantic-html | fix | B | keep — fix required |
| 3.1 | [json-ld-present](./structured-data/json-ld-present.md) | structured-data | fix | A | keep — fix required |
| 3.2 | [schema-validation](./structured-data/schema-validation.md) | structured-data | fix | — | keep — fix required |
| 3.3 | [organization-schema](./structured-data/organization-schema.md) | structured-data | fix | — | keep — fix required |
| 3.4 | [website-search-action](./agent-interfaces/website-search-action.md) | structured-data | fix | D | keep — fix required |
| 3.5 | [breadcrumb-schema](./structured-data/breadcrumb-schema.md) | structured-data | fix | — | keep — fix required |
| 3.6 | [article-schema](./structured-data/article-schema.md) | structured-data | fix | — | keep — fix required |
| 3.7 | [faqpage-schema](./structured-data/faqpage-schema.md) | structured-data | fix | — | keep — fix required |
| 3.8 | [service-product-schema](./structured-data/service-product-schema.md) | structured-data | merge | A | merge (approved 2026-08-21) |
| 3.9 | [speakable-schema](./structured-data/speakable-schema.md) | structured-data | delete | A | kept — rewrite required (approved 2026-08-21) |
| 3.10 | [potential-action](./structured-data/potential-action.md) | structured-data | delete | D | sunset (approved 2026-08-21) |
| 3.11 | [howto-schema](./structured-data/howto-schema.md) | structured-data | delete | C | informative, weight 0 (approved 2026-08-21) |
| 3.12 | [local-business-schema](./structured-data/local-business-schema.md) | structured-data | fix | — | keep — fix required |
| 3.13 | [review-schema](./structured-data/review-schema.md) | structured-data | fix | — | keep — fix required |
| 3.14 | [offer-schema](./agentic-commerce/offer-schema.md) | structured-data | fix | — | keep — fix required |
| 3.15 | [author-schema](./structured-data/author-schema.md) | structured-data | fix | — | keep — fix required |
| 3.16 | [action-schema](./structured-data/action-schema.md) | structured-data | delete | D | sunset (approved 2026-08-21) |
| 3.21 | [product-identifiers](./agentic-commerce/product-identifiers.md) | structured-data | fix | — | keep — fix required |
| 3.22 | [advanced-product-details](./structured-data/advanced-product-details.md) | structured-data | fix | — | keep — fix required |
| 3.23 | [product-reviews](./structured-data/product-reviews.md) | structured-data | merge | — | merge (approved 2026-08-21) |
| 3.24 | [product-transaction-certainty](./agentic-commerce/product-transaction-certainty.md) | structured-data | fix | — | keep — fix required |
| 8.1 | [https-enabled](./access-crawl-control/https-enabled.md) | technical-readiness | fix | A | keep — fix required |
| 8.2 | [hsts-header](../merged/operability-safety/hsts-header.md) | technical-readiness | merge | B | merged into [operability-safety/security-header-hygiene](./operability-safety/security-header-hygiene.md) (2026-08-22) |
| 8.3 | [csp-header](../merged/operability-safety/csp-header.md) | technical-readiness | fix | D | merged into [operability-safety/security-header-hygiene](./operability-safety/security-header-hygiene.md) (2026-08-22) |
| 8.4 | [content-type-options](../merged/operability-safety/content-type-options.md) | technical-readiness | merge | C | merged into [operability-safety/security-header-hygiene](./operability-safety/security-header-hygiene.md) (2026-08-22) |
| 8.5 | [referrer-policy](./technical-readiness/referrer-policy.md) | technical-readiness | delete | D | sunset (approved 2026-08-21) |
| 8.6 | [permissions-policy](./technical-readiness/permissions-policy.md) | technical-readiness | delete | D | sunset (approved 2026-08-21) |
| 8.7 | [security-txt](../merged/operability-safety/security-txt.md) | technical-readiness | delete | C | merged into [operability-safety/security-header-hygiene](./operability-safety/security-header-hygiene.md) (2026-08-22) |
| 8.8 | [cors-ai-files](./machine-discovery/cors-ai-files.md) | technical-readiness | fix | C | keep — fix required |
| 8.9 | [cors-api-routes](./agent-interfaces/cors-api-routes.md) | technical-readiness | delete | C | proposed: redeem as scored (pending triage) |
| 8.10 | [correct-content-types](./machine-discovery/ai-file-delivery.md) | technical-readiness | fix | C | keep — fix required |
| 8.11 | [cache-headers](../merged/machine-discovery/cache-headers.md) | technical-readiness | merge | B | merged into [machine-discovery/ai-file-delivery](./machine-discovery/ai-file-delivery.md) (2026-08-22) |
| 8.12 | [fast-response-time](./content-extraction/fast-response-time.md) | technical-readiness | fix | B | keep — fix required |
| 8.13 | [server-rendered](./content-extraction/server-rendered.md) | technical-readiness | fix | B | keep — fix required |
| 8.14 | [no-render-blocking](../sunset/technical-readiness/no-render-blocking.md) | technical-readiness | fix | D | sunset (2026-08-21) |
| 8.15 | [image-dimensions](../sunset/technical-readiness/image-dimensions.md) | technical-readiness | fix | D | sunset (2026-08-21) |
| 8.16 | [lcp-not-lazy](../sunset/technical-readiness/lcp-not-lazy.md) | technical-readiness | fix | D | sunset (2026-08-21) |
| 8.17 | [preconnect-hints](./technical-readiness/preconnect-hints.md) | technical-readiness | delete | D | sunset (approved 2026-08-21) |
| 8.18 | [no-broken-ai-endpoints](./machine-discovery/no-broken-ai-endpoints.md) | technical-readiness | fix | A | keep — fix required |
| 8.19 | [privacy-policy](../sunset/technical-readiness/privacy-policy.md) | technical-readiness | fix | D | sunset (2026-08-21) |
| 8.20 | [terms-of-service](../sunset/technical-readiness/terms-of-service.md) | technical-readiness | fix | D | sunset (2026-08-21) |
| 8.21 | [framework-detection](./technical-readiness/framework-detection.md) | technical-readiness | delete | D | sunset (approved 2026-08-21) |

## Evidence banked for checks that do not exist yet

The 2026-08-20 evidence research graded 82 signals that map to no current audit (mostly granular robots.txt semantics, per-bot directives for uncovered bots, and snippet-control directives). They feed the [proposed new checks](../proposals/README.md) and the taxonomy design.

| Grade | Signal | Domain | Recommended tier |
| :---- | :----- | :----- | :--------------- |
| A | a2a-agent-card | agent-action-surfaces | informative |
| A | AI answers suppress clicks to source websites | empirical-adoption | scored |
| A | AI chatbot usage for news and information seeking | empirical-adoption | scored |
| A | AI crawler compliance with robots.txt | empirical-adoption | scored |
| A | AI crawler growth rate and operator composition | empirical-adoption | scored |
| A | AI crawler share of total web traffic (baseline number) | empirical-adoption | scored |
| A | BreadcrumbList schema | structured-data | scored |
| A | Crawl purpose split (training vs AI search vs user action) | empirical-adoption | scored |
| A | Crawl-to-refer ratio (extraction vs traffic returned) | empirical-adoption | scored |
| A | Organization schema (name, logo, url, sameAs, address, contactPoint) | structured-data | scored |
| A | Perplexity-User allow/block state in robots.txt | robots-ai-crawlers | informative |
| A | Review / AggregateRating markup | structured-data | scored |
| A | robots.txt AI-bot blocking rates over time | empirical-adoption | scored |
| A | robots.txt parsed per RFC 9309 (group merging, longest-match precedence, * and $ wildcards, status-code semantics, 500 KiB limit) | robots-ai-crawlers | scored |
| A | Structured data adoption rate on the web | empirical-adoption | scored |
| A | title tag (<title>) | meta-head | scored |
| A | Visible dates on content (published / last updated) | aeo-content | scored |
| A | X-Robots-Tag / meta robots standard directives (noindex, nosnippet, max-snippet, data-nosnippet) as AI-content controls | robots-ai-crawlers | scored |
| B | AI crawlers do not execute JavaScript | empirical-adoption | scored |
| B | AI referral traffic share of site visits | empirical-adoption | scored |
| B | Article schema with author, datePublished and dateModified | structured-data | scored |
| B | Bot-token directory freshness: darkvisitors.com has become knownagents.com, and several commonly-audited tokens are dead, renamed, or newly split | robots-ai-crawlers | informative |
| B | Cloudflare Content Signals Policy (Content-Signal directive in robots.txt) | robots-ai-crawlers | informative |
| B | Crawler efficiency waste (404 rates on AI crawlers) | empirical-adoption | scored |
| B | Direct answer in first paragraph / inverted pyramid | aeo-content | scored |
| B | Effect of agent-ready site design on agent task success | empirical-adoption | scored |
| B | External citations and outbound links to authoritative sources | geo-authority | scored |
| B | llms.txt adoption rate across the web | empirical-adoption | scored |
| B | LocalBusiness schema (NAP, openingHours, geo, departments) | structured-data | scored |
| B | MCP registry size and growth | empirical-adoption | scored |
| B | meta description (<meta name="description">) | meta-head | scored |
| B | OAI-AdsBot allow/block state in robots.txt | robots-ai-crawlers | informative |
| B | openapi-document-published | agent-action-surfaces | scored |
| B | Pagination discovery — paginated listings exposed as crawlable sequential <a href> links | discovery-infra | scored |
| B | Prevalence of GEO-optimized content in live results | empirical-adoption | scored |
| B | Self-contained extractable passages ("chunkability") | aeo-content | scored |
| B | Share of AI answers that cite web sources, and what they cite | empirical-adoption | scored |
| B | Sitemap directive present in robots.txt | robots-ai-crawlers | scored |
| B | Specific numbers and statistics in content | aeo-content | scored |
| B | Unique data and original statistics | geo-authority | scored |
| B | webmcp-register-tool | agent-action-surfaces | experimental |
| B | Which page factors causally drive citation selection | empirical-adoption | scored |
| C | Ahrefs Brand Radar — large-N prompt data, no site-side AI audit | competitive-landscape | informative |
| C | AI assistant market share (which agents matter) | empirical-adoption | informative |
| C | AI referral conversion quality and downstream brand effect | empirical-adoption | informative |
| C | axe-core / Deque rule documentation model — the per-rule dossier template | competitive-landscape | informative |
| C | Bot share of total web traffic (context baseline) | empirical-adoption | informative |
| C | Breadcrumbs (visible breadcrumb trail and/or BreadcrumbList JSON-LD) | discovery-infra | informative |
| C | byte5ai/claude-agent-readiness-skill — prior art on evidence-tiered AI-readiness auditing | competitive-landscape | informative |
| C | Category-level counter-evidence: Google says no special AI optimization is required | competitive-landscape | informative |
| C | Cloudflare AI Crawl Control — adjacent ground truth we cannot produce and should cite | competitive-landscape | informative |
| C | Definition patterns ("X is Y" definitional sentences) | aeo-content | informative |
| C | FAQ sections in content (visible Q&A pairs) | aeo-content | informative |
| C | FAQPage schema after Google's 2023 restriction and 2026 removal | structured-data | informative |
| C | Gap analysis: where Agent Lighthouse is actually differentiated | competitive-landscape | informative |
| C | Google Lighthouse — the professionalism benchmark we are explicitly imitating | competitive-landscape | informative |
| C | hreflang annotations (<link rel="alternate" hreflang="...">) | meta-head | informative |
| C | HubSpot AI Search Grader — publishes weights, audits no website | competitive-landscape | informative |
| C | Incumbent technical-SEO crawlers have not annexed AI-readiness auditing | competitive-landscape | informative |
| C | Internal cross-linking | geo-authority | informative |
| C | isitagentready.com — closest hosted competitor by scope, zero published evidence | competitive-landscape | informative |
| C | lang attribute (<html lang>) | meta-head | informative |
| C | llmtxt.info Observatory — the only competitor already doing versioned, reproducible measurement | competitive-landscape | informative |
| C | mcp-registry-publication | agent-action-surfaces | informative |
| C | meta author (<meta name="author">) | meta-head | informative |
| C | noai / noimageai directives in meta robots or X-Robots-Tag | robots-ai-crawlers | informative |
| C | Numbered step lists for procedural content | aeo-content | informative |
| C | Open-source 'Lighthouse for AI' long tail — crowded, undifferentiated, unadopted | competitive-landscape | informative |
| C | openapi-conventional-location-discovery | agent-action-surfaces | informative |
| C | Otterly.AI — prompt tracking plus a lightly-specified 'Content Audit' | competitive-landscape | informative |
| C | Overall strength of evidence for GEO/AI-optimization tactics | empirical-adoption | informative |
| C | Profound — enterprise AI-visibility monitoring, no published methodology | competitive-landscape | informative |
| C | Publisher-side scrape and referral panel data (TollBit) | empirical-adoption | informative |
| C | Semrush AI toolkit / AI visibility — surveyed but URL-unverified | competitive-landscape | informative |
| C | speakable / SpeakableSpecification | structured-data | informative |
| C | The Website Specification (jdevalk) — the credibility leader, and it publishes counter-evidence | competitive-landscape | informative |
| C | UTF-8 BOM at the start of robots.txt is tolerated / stripped | robots-ai-crawlers | informative |
| C | W3C ACT Rules Format — ratified precedent for mandatory 'Assumptions' and 'Accessibility Support' fields | competitive-landscape | informative |
| C | WordLift — schema/knowledge-graph vendor pivoting to AI visibility audits | competitive-landscape | informative |
| D | Agentic browser (Comet, Atlas, Copilot Mode) usage and market share | empirical-adoption | experimental |
| D | HowTo schema after Google's 2023 deprecation | structured-data | delete |
| D | meta keywords (<meta name="keywords">) | meta-head | delete |
