# v1 → v2 audit map

Draft mapping of every registered v1 audit to its v2 home, per the approved taxonomy in
[`docs/superpowers/specs/2026-08-21-audit-restructure-design.md`](../superpowers/specs/2026-08-21-audit-restructure-design.md)
(§3 categories, §5 merges/splits/consolidations, §6 `category/slug` identity).

- **Rows in this table: 189** (unchanged — the 8 sunset rows stay as rows, with `—` for their v2 category/slug)
- **Registered audits in `packages/core/src/audit-config.ts`: 189** (`grep -c 'reg('` returns 190; one hit is the `function reg(...)` helper definition on line 30)

Source of v1 ids: `meta.id` in each audit source file. Numeric ids die in v2 (§6); the `v2 category` + `v2 slug`
columns form the new stable id `category/slug`.

Action legend:

| action | meaning |
| :--- | :--- |
| `move` | plain relocation into a v2 category (may include a §5 rename, or a file split out of `_a11y.ts` per §6) |
| `merge-away` | audit disappears into another audit (§5 merge list, or the C3 file+discovery-link collapse) |
| `split` | §5 split — audit's halves land in two places |
| `consolidate` | §5 security-header hygiene consolidation (weight 0) |
| `rewrite` | carries a `TODO(redeem)` header in `packages/core/src/audits/REWORK-TODO.md`, or is rewritten as part of a decided merge — still gets a v2 home |
| `sunset` | retired — no v2 `category/slug`; the row stays for traceability |

All 20 open `REVIEW:` flags are resolved — **0 open**. Every row carrying a resolved call says so with a
`decided 2026-08-21:` phrase in its notes; see [Decisions (2026-08-21)](#decisions-2026-08-21).

## Mapping

| v1 id | v1 file (category/slug) | v2 category (slug from §3) | v2 slug | action | notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | content-discoverability/llms-txt-exists | machine-discovery | llms-txt-exists | move | C3 collapse: absorbs meta-tags/llms-txt-link (4.11) — one audit checks the file and its discovery link together |
| 1.2 | content-discoverability/llms-txt-blockquote | machine-discovery | llms-txt-structure | merge-away | §5: llms-txt-blockquote + llms-txt-sections → one llms.txt structure audit |
| 1.3 | content-discoverability/llms-txt-sections | machine-discovery | llms-txt-structure | merge-away | §5: same combined llms.txt structure audit (this row supplies the section-shape half) |
| 1.4 | content-discoverability/llms-txt-link-descriptions | machine-discovery | llms-txt-link-descriptions | move | stays separate — §5 merges only blockquote + sections |
| 1.5 | content-discoverability/llms-txt-links-valid | machine-discovery | llms-txt-links-valid | move | |
| 1.6 | content-discoverability/llms-full-txt | machine-discovery | llms-full-txt | move | |
| 1.7 | content-discoverability/sitemap-exists | machine-discovery | sitemap-exists | move | |
| 1.8 | content-discoverability/sitemap-key-pages | machine-discovery | discovery-index-coverage | move | §5 rename ("discovery index coverage"); merge target for no-orphan-pages (1.22) |
| 1.9 | content-discoverability/sitemap-absolute-urls | machine-discovery | sitemap-absolute-urls | move | |
| 1.10 | content-discoverability/sitemap-lastmod | machine-discovery | sitemap-lastmod | move | |
| 1.11 | content-discoverability/rss-feed | machine-discovery | rss-feed | move | C3 collapse: absorbs meta-tags/rss-feed-link (4.16) |
| 1.12 | content-discoverability/rss-feed-content | machine-discovery | rss-feed-content | move | |
| 1.13 | content-discoverability/no-noindex | access-crawl-control | robots-directives | merge-away | decided 2026-08-21: merge-away into access-crawl-control/robots-directives (2.25 is the surviving row) |
| 1.14 | content-discoverability/no-nofollow | access-crawl-control | no-nofollow | move | crawl directive |
| 1.15 | content-discoverability/internal-linking | machine-discovery | in-content-links | rewrite | decided 2026-08-21: merged with 10.11 internal-cross-linking into one rewritten audit `machine-discovery/in-content-links` — in-content links only |
| 1.16 | content-discoverability/no-redirect-chains | access-crawl-control | no-redirect-chains | move | reachability, not discovery |
| 1.17 | content-discoverability/canonical-links | access-crawl-control | canonical | rewrite | decided 2026-08-21: merged with 4.3 canonical-url into one audit `access-crawl-control/canonical` — resolved hrefs, homepage-collapse detection |
| 1.18 | content-discoverability/mobile-friendly | — | — | sunset | decided 2026-08-21: sunset — no proven consumer, viewport tag ubiquitous |
| 1.19 | content-discoverability/fast-page-load | content-extraction | server-responsiveness | rewrite | decided 2026-08-21: merged with 8.12 fast-response-time into one audit `content-extraction/server-responsiveness` — median TTFB, banded |
| 1.20 | content-discoverability/no-broken-links | machine-discovery | no-broken-links | move | decided 2026-08-21: confirmed — machine-discovery |
| 1.22 | content-discoverability/no-orphan-pages | machine-discovery | discovery-index-coverage | merge-away | §5: no-orphan-pages → sitemap-key-pages ("discovery index coverage") |
| 1.23 | content-discoverability/commerce-links | — | — | sunset | decided 2026-08-21: sunset — grade D, no documented consumer |
| 2.1 | crawler-permissions/gptbot | access-crawl-control | gptbot | move | |
| 2.2 | crawler-permissions/google-extended | access-crawl-control | google-extended | move | |
| 2.3 | crawler-permissions/anthropic | access-crawl-control | anthropic-ai | move | slug de-numericised/clarified to the UA token it checks |
| 2.4 | crawler-permissions/perplexitybot | access-crawl-control | perplexitybot | move | |
| 2.5 | crawler-permissions/applebot-extended | access-crawl-control | applebot-extended | move | |
| 2.6 | crawler-permissions/ccbot | access-crawl-control | ccbot | move | |
| 2.7 | crawler-permissions/meta-external-agent | access-crawl-control | meta-external-agent | move | |
| 2.8 | crawler-permissions/amazonbot | access-crawl-control | amazonbot | move | |
| 2.9 | crawler-permissions/bytespider | access-crawl-control | ai-bot-directives | rewrite | redemption rewrite — REWORK-TODO folds all low-signal per-bot audits into one `ai-bot-directives` audit |
| 2.10 | crawler-permissions/cohere-ai | access-crawl-control | ai-bot-directives | rewrite | redemption rewrite — same `ai-bot-directives` consolidation |
| 2.11 | crawler-permissions/youbot | access-crawl-control | ai-bot-directives | rewrite | redemption rewrite — same `ai-bot-directives` consolidation |
| 2.12 | crawler-permissions/diffbot | access-crawl-control | ai-bot-directives | rewrite | redemption rewrite — same `ai-bot-directives` consolidation |
| 2.13 | crawler-permissions/ai2bot | access-crawl-control | ai-bot-directives | rewrite | redemption rewrite — same `ai-bot-directives` consolidation |
| 2.14 | crawler-permissions/chatgpt-user | access-crawl-control | chatgpt-user | move | |
| 2.15 | crawler-permissions/claude-user | access-crawl-control | claude-user | move | |
| 2.16 | crawler-permissions/oai-searchbot | access-crawl-control | oai-searchbot | move | |
| 2.17 | crawler-permissions/meta-external-fetcher | access-crawl-control | meta-external-fetcher | move | |
| 2.18 | crawler-permissions/bravebot | access-crawl-control | bravebot | move | |
| 2.19 | crawler-permissions/duckassistbot | access-crawl-control | duckassistbot | move | |
| 2.20 | crawler-permissions/mistralai-user | access-crawl-control | mistralai-user | move | |
| 2.21 | crawler-permissions/claude-searchbot | access-crawl-control | claude-searchbot | move | |
| 2.22 | crawler-permissions/no-blanket-block | access-crawl-control | no-blanket-block | move | |
| 2.23 | crawler-permissions/sensitive-paths | access-crawl-control | sensitive-paths | rewrite | redemption rewrite — grade A mechanism, needs path-matching surgery per RFC 9309 |
| 2.24 | crawler-permissions/crawl-delay | access-crawl-control | crawl-delay | move | |
| 2.25 | crawler-permissions/meta-robots-not-blocking | access-crawl-control | robots-directives | rewrite | decided 2026-08-21: merged with 1.13 no-noindex + 4.20 meta-robots into one audit `access-crawl-control/robots-directives` — all pages, meta + `X-Robots-Tag`, token-parsed |
| 2.26 | crawler-permissions/no-bot-detection | access-crawl-control | no-bot-detection | move | §3 cat 1 names it explicitly |
| 2.27 | crawler-permissions/tdm-rep | access-crawl-control | tdm-rep | rewrite | redemption rewrite — experimental tier, fix internal incoherence |
| 2.28 | crawler-permissions/agent-governance | access-crawl-control | agent-governance | move | decided 2026-08-21: confirmed — access-crawl-control |
| 3.1 | structured-data/json-ld-present | structured-data | json-ld-present | move | |
| 3.2 | structured-data/schema-validation | structured-data | schema-validation | move | |
| 3.3 | structured-data/organization-schema | structured-data | organization-schema | move | |
| 3.4 | structured-data/website-search-action | agent-interfaces | search-endpoint | merge-away | decided 2026-08-21: merge-away into agent-interfaces/search-endpoint (5.16 is the surviving row) |
| 3.5 | structured-data/breadcrumb-schema | structured-data | breadcrumb-schema | move | |
| 3.6 | structured-data/article-schema | structured-data | article-schema | move | |
| 3.7 | structured-data/faqpage-schema | structured-data | faqpage-schema | move | C9 FAQ cluster resolves via shared gatherer, not a merge |
| 3.8 | structured-data/service-product-schema | structured-data | service-schema | split | §5 split: Product half → structured-data/advanced-product-details (3.22); Service half stays standalone, narrowed to Service/ProfessionalService |
| 3.9 | structured-data/speakable-schema | structured-data | speakable-schema | rewrite | redemption rewrite — narrow to news/article publishers, drop the Alexa/Siri claim. decided 2026-08-21: confirmed — structured-data |
| 3.11 | structured-data/howto-schema | structured-data | howto-schema | move | |
| 3.12 | structured-data/local-business-schema | structured-data | local-business-schema | move | |
| 3.13 | structured-data/review-schema | structured-data | review-schema | move | merge target for product-reviews (3.23); C8 reviews cluster resolves via shared gatherer |
| 3.14 | structured-data/offer-schema | agentic-commerce | offer-schema | move | §3 cat 7 "commerce halves of product schema" — price/availability is the buy path |
| 3.15 | structured-data/author-schema | structured-data | author-schema | move | C4 authors cluster resolves via shared gatherer with 10.1–10.3, not a merge |
| 3.21 | structured-data/product-identifiers | agentic-commerce | product-identifiers | move | decided 2026-08-21: confirmed — agentic-commerce (GTIN/MPN are consumed by shopping agents) |
| 3.22 | structured-data/product-details | structured-data | advanced-product-details | move | §5 rename; absorbs the Product half of service-product-schema (3.8) |
| 3.23 | structured-data/product-reviews | structured-data | review-schema | merge-away | §5: product-reviews → review-schema |
| 3.24 | structured-data/product-transaction-certainty | agentic-commerce | product-transaction-certainty | move | transaction-certainty fields are the checkout half of product schema (§3 cat 7) |
| 4.1 | meta-tags/meta-description | answer-readiness | meta-description | move | meta-tags dissolves; consumer is snippet/answer selection. Merge target for meta-description-aeo (9.11); C15 cluster |
| 4.2 | meta-tags/meta-author | answer-readiness | meta-author | move | author/E-E-A-T signal, C4 cluster via shared gatherer |
| 4.3 | meta-tags/canonical-url | access-crawl-control | canonical | merge-away | decided 2026-08-21: merge-away into access-crawl-control/canonical (1.17 is the surviving row) |
| 4.4 | meta-tags/language-attribute | content-extraction | language-attribute | move | `lang` drives extractor/tokenizer behaviour |
| 4.5 | meta-tags/unique-meta | answer-readiness | unique-meta | move | duplicate titles/descriptions degrade answer selection |
| 4.6 | meta-tags/core-open-graph | answer-readiness | core-open-graph | move | §3 cat 5 "og/display tags from meta-tags"; merge target for og-site-name (4.8) and the social-meta fold of twitter-card (4.10) |
| 4.7 | meta-tags/og-type | answer-readiness | og-type | move | |
| 4.8 | meta-tags/og-site-name | answer-readiness | core-open-graph | merge-away | §5: og-site-name → core-open-graph |
| 4.9 | meta-tags/og-image-alt | answer-readiness | og-image-alt | move | |
| 4.10 | meta-tags/twitter-card | answer-readiness | core-open-graph | rewrite | redemption rewrite — fix the twitter:*/og:* fallback errors and fold into the social-meta diagnostic alongside core-open-graph, informative tier |
| 4.11 | meta-tags/llms-txt-link | machine-discovery | llms-txt-exists | merge-away | C3 collapse: file + discovery link become one audit |
| 4.13 | meta-tags/ai-content-declaration | access-crawl-control | ai-content-declaration | rewrite | redemption rewrite — experimental tier, check the real opt-out directive names; decided 2026-08-21: experimental tier (active declaration-spec trajectory) |
| 4.15 | meta-tags/markdown-alternate | content-extraction | markdown-alternate | move | §3 cat 2 "markdown alternates" |
| 4.16 | meta-tags/rss-feed-link | machine-discovery | rss-feed | merge-away | C3 collapse: feed file + its `<link rel=alternate>` become one audit |
| 4.18 | meta-tags/openapi-link | agent-interfaces | openapi-exists | merge-away | TODO(redeem) resolves as a merge: one discovery audit incl. RFC 9727 api-catalog; drop the link-tag requirement |
| 4.19 | meta-tags/ai-catalog-link | agent-interfaces | ai-catalog-exists | merge-away | TODO(redeem) grade B; C3 collapse — manifest file + `rel` link checked by one audit |
| 4.20 | meta-tags/meta-robots | access-crawl-control | robots-directives | merge-away | decided 2026-08-21: merge-away into access-crawl-control/robots-directives (2.25 is the surviving row) |
| 5.1 | agent-tools/openapi-exists | agent-interfaces | openapi-exists | move | absorbs meta-tags/openapi-link (4.18) |
| 5.2 | agent-tools/openapi-endpoints | agent-interfaces | openapi-endpoints | move | |
| 5.3 | agent-tools/openapi-operation-ids | agent-interfaces | openapi-operation-ids | move | receives the naming-rule half of webmcp-tool-naming (5.23) per §5 |
| 5.5 | agent-tools/openapi-servers | agent-interfaces | openapi-servers | move | |
| 5.6 | agent-tools/openapi-schemas | agent-interfaces | openapi-schemas | move | |
| 5.7 | agent-tools/ai-catalog-exists | agent-interfaces | ai-catalog-exists | rewrite | redemption rewrite — grade A; pass condition becomes specVersion + host + entries[] per ARD §4.1; absorbs 4.19 |
| 5.8 | agent-tools/ai-catalog-metadata | agent-interfaces | ai-catalog-metadata | rewrite | redemption rewrite — grade B; every checked field is currently wrong |
| 5.9 | agent-tools/ai-catalog-urls | agent-interfaces | ai-catalog-urls | rewrite | redemption rewrite — grade B; liveness of manifest-listed endpoints |
| 5.10 | agent-tools/agents-json | agent-interfaces | agents-json | move | |
| 5.12 | agent-tools/mcp-discovery | agent-interfaces | mcp-discovery | move | |
| 5.13 | agent-tools/mcp-endpoint | agent-interfaces | mcp-endpoint | move | merge target for mcp-capabilities (5.14) and webmcp-tool-annotations (5.24) |
| 5.14 | agent-tools/mcp-capabilities | agent-interfaces | mcp-endpoint | merge-away | §5: mcp-capabilities → mcp-endpoint |
| 5.15 | agent-tools/contact-form | operability-safety | contact-form | move | decided 2026-08-21: confirmed — operability-safety |
| 5.16 | agent-tools/search-endpoint | agent-interfaces | search-endpoint | rewrite | decided 2026-08-21: confirmed — agent-interfaces; absorbs 3.4 website-search-action, rewritten to read SearchAction array-safe and verify that results come back |
| 5.18 | agent-tools/no-blocking-captcha | operability-safety | no-blocking-captcha | rewrite | decided 2026-08-21: confirmed — operability-safety, form-scoped rewrite |
| 5.19 | agent-tools/forms-no-js | operability-safety | forms-no-js | move | §3 cat 8 "form actionability" |
| 5.20 | agent-tools/webmcp-manifest | agent-interfaces | webmcp-registered-tools | rewrite | redemption rewrite — the `.well-known` manifest is invented (grade D); replace with runtime registered-tools detection, experimental tier |
| 5.21 | agent-tools/webmcp-declarative-forms | agent-interfaces | webmcp-declarative-forms | rewrite | redemption rewrite — grade A (W3C WebML CG explainer, `declarative-webmcp` Baseline feature) |
| 5.22 | agent-tools/webmcp-input-quality | operability-safety | form-actionability | merge-away | §5: webmcp-input-quality → form-actionability |
| 5.23 | agent-tools/webmcp-tool-naming | agent-interfaces | openapi-operation-ids | split | §5 split: naming rule → openapi-operation-ids; runtime part deferred to a future MCP tools/list check (not a v2.0 audit) |
| 5.24 | agent-tools/webmcp-tool-annotations | agent-interfaces | mcp-endpoint | merge-away | §5: webmcp-tool-annotations → mcp-endpoint (tools/list annotations) |
| 5.26 | agent-tools/openapi-description-quality | agent-interfaces | openapi-description-quality | move | |
| 5.27 | agent-tools/form-actionability | operability-safety | form-actionability | move | §3 cat 8 "form actionability"; merge target for 5.22 |
| 6.1 | semantic-html/single-h1 | content-extraction | single-h1 | move | |
| 6.2 | semantic-html/sequential-headings | content-extraction | sequential-headings | move | |
| 6.3 | semantic-html/main-element | content-extraction | main-element | move | |
| 6.4 | semantic-html/article-element | content-extraction | article-element | move | |
| 6.5 | semantic-html/header-footer | content-extraction | header-footer | move | |
| 6.6 | semantic-html/aside-element | content-extraction | aside-element | rewrite | redemption rewrite — grade B (Readability/trafilatura strip `<aside>`; Chromium exposes it as `complementary`) |
| 6.7 | semantic-html/section-headings | content-extraction | section-headings | move | |
| 6.8 | semantic-html/semantic-lists | content-extraction | semantic-lists | move | merge target for definition-elements (6.13) |
| 6.9 | semantic-html/data-tables | content-extraction | data-tables | move | |
| 6.10 | semantic-html/code-language | content-extraction | code-language | move | |
| 6.11 | semantic-html/time-element | content-extraction | time-element | move | C1 dates cluster resolves via shared gatherer |
| 6.13 | semantic-html/definition-elements | content-extraction | semantic-lists | merge-away | §5: definition-elements → semantic-lists |
| 6.14 | semantic-html/content-depth | content-extraction | content-depth | move | |
| 6.15 | semantic-html/image-alt-text | content-extraction | image-alt-text | move | decided 2026-08-21: confirmed — content-extraction |
| 6.17 | semantic-html/figure-figcaption | content-extraction | figure-figcaption | move | |
| 6.18 | semantic-html/svg-bloat | content-extraction | svg-bloat | move | pairs with the token-economics proposals (§6 maps token-economics → cat 2) |
| 6.19 | semantic-html/token-ratio | content-extraction | token-ratio | move | token-economics home |
| 6.20 | semantic-html/fake-headings | content-extraction | fake-headings | move | |
| 7.2 | accessibility/aria-landmarks | operability-safety | aria-landmarks | move | accessibility renames to operability-safety (§3) |
| 7.3 | accessibility/nav-aria-label | operability-safety | landmark-unique | merge-away | §5: nav-aria-label → landmark-unique |
| 7.4 | accessibility/_a11y.ts#landmark-unique | operability-safety | landmark-unique | move | §6: split out of `_a11y.ts` into its own file; merge target for 7.3 |
| 7.5 | accessibility/_a11y.ts#form-labels | operability-safety | label | move | §6 file split. decided 2026-08-21: confirmed — slug `label` |
| 7.6 | accessibility/form-error-messages | operability-safety | form-error-messages | rewrite | redemption rewrite — verify aria-describedby/aria-errormessage on invalid inputs instead of the current heuristic |
| 7.7 | accessibility/_a11y.ts#accessible-names | operability-safety | accessible-names | move | §6 file split; wraps `button-name` + `link-name` |
| 7.9 | accessibility/_a11y.ts#dialog-name | operability-safety | dialog-name | move | §6 file split; wraps `aria-dialog-name` |
| 7.10 | accessibility/_a11y.ts#aria-hidden-body | operability-safety | aria-hidden-body | move | §6 file split |
| 7.11 | accessibility/_a11y.ts#aria-roles | operability-safety | aria-roles | move | §6 file split; wraps `aria-roles`, `aria-deprecated-role`, `aria-allowed-role` |
| 7.12 | accessibility/_a11y.ts#aria-attributes | operability-safety | aria-attributes | move | §6 file split; wraps the four aria-attr rules |
| 7.13 | accessibility/_a11y.ts#aria-relationships | operability-safety | aria-relationships | move | §6 file split; wraps the three aria-required-* rules |
| 7.14 | accessibility/_a11y.ts#duplicate-id | operability-safety | duplicate-id | move | §6 file split; wraps `duplicate-id-aria` |
| 7.15 | accessibility/_a11y.ts#autocomplete | operability-safety | autocomplete | move | §6 file split; pairs with the form-autofill-token-coverage proposal |
| 7.16 | accessibility/_a11y.ts#nested-interactive | operability-safety | nested-interactive | move | §6 file split |
| 7.17 | accessibility/_a11y.ts#table-headers | operability-safety | table-headers | move | §6 file split; wraps the four table rules |
| 7.18 | accessibility/_a11y.ts#document-title | operability-safety | document-title | move | §6 file split |
| 7.19 | accessibility/_a11y.ts#frame-title | operability-safety | frame-title | move | §6 file split; wraps `frame-title` + `frame-title-unique` |
| 7.20 | accessibility/_a11y.ts#meta-refresh | operability-safety | meta-refresh | move | §6 file split |
| 7.21 | accessibility/_a11y.ts#tabindex | operability-safety | tabindex | move | §6 file split |
| 7.22 | accessibility/_a11y.ts#deprecated-elements | — | — | sunset | decided 2026-08-21: sunset — grade D, mechanism proven false (marquee text is stable DOM text) |
| 7.23 | accessibility/_a11y.ts#presentation-conflict | operability-safety | presentation-conflict | move | §6 file split |
| 8.1 | technical-readiness/https-enabled | access-crawl-control | https-enabled | move | decided 2026-08-21: confirmed — access-crawl-control, scored; judge the protocol after redirects |
| 8.2 | technical-readiness/hsts-header | operability-safety | security-header-hygiene | consolidate | §5 consolidation, weight 0, never fails a site |
| 8.3 | technical-readiness/csp-header | operability-safety | security-header-hygiene | consolidate | §5 consolidation (audits 8.3–8.7) |
| 8.4 | technical-readiness/content-type-options | operability-safety | security-header-hygiene | consolidate | §5 consolidation; nosniff additionally becomes a sub-signal of machine-discovery/ai-file-delivery |
| 8.7 | technical-readiness/security-txt | operability-safety | security-header-hygiene | consolidate | §5 consolidation (audits 8.3–8.7) |
| 8.8 | technical-readiness/cors-ai-files | machine-discovery | cors-ai-files | move | §3 cat 3 "delivery checks from technical-readiness" |
| 8.9 | technical-readiness/cors-api-routes | agent-interfaces | cors-api-routes | rewrite | redemption rewrite — stays scored but `notApplicable` unless the site exposes a public cross-origin API surface |
| 8.10 | technical-readiness/correct-content-types | machine-discovery | ai-file-delivery | move | §5 rename ("AI file delivery"); merge target for cache-headers (8.11); gains nosniff sub-signal from 8.4 |
| 8.11 | technical-readiness/cache-headers | machine-discovery | ai-file-delivery | merge-away | §5: cache-headers → correct-content-types ("AI file delivery") |
| 8.12 | technical-readiness/fast-response-time | content-extraction | server-responsiveness | merge-away | decided 2026-08-21: merge-away into content-extraction/server-responsiveness (1.19 is the surviving row) |
| 8.13 | technical-readiness/server-rendered | content-extraction | server-rendered | move | §3 cat 2 "rendering checks from technical-readiness" |
| 8.14 | technical-readiness/no-render-blocking | — | — | sunset | decided 2026-08-21: sunset — grade D, human-viewport performance signal, no agent consumer |
| 8.15 | technical-readiness/image-dimensions | — | — | sunset | decided 2026-08-21: sunset — grade D CLS proxy, no agent consumer |
| 8.16 | technical-readiness/lcp-not-lazy | — | — | sunset | decided 2026-08-21: sunset — grade D, `images[0]` is not an LCP proxy |
| 8.18 | technical-readiness/no-broken-ai-endpoints | machine-discovery | no-broken-ai-endpoints | move | decided 2026-08-21: confirmed — machine-discovery whole, no per-surface split; same-origin fix, drop the navigation.json source |
| 8.19 | technical-readiness/privacy-policy | — | — | sunset | decided 2026-08-21: sunset — grade D generic trust claim; the ACP link-surface proposal covers the evidenced commerce case |
| 8.20 | technical-readiness/terms-of-service | — | — | sunset | decided 2026-08-21: sunset — grade D, no documented consumer, English-only detector |
| 9.1 | answer-engine/faq-sections | answer-readiness | faq-sections | move | answer-engine + generative-engine fuse (§3) |
| 9.2 | answer-engine/question-headings | answer-readiness | question-headings | move | |
| 9.3 | answer-engine/first-paragraph-answers | answer-readiness | first-paragraph-answers | move | |
| 9.4 | answer-engine/direct-definitions | answer-readiness | direct-definitions | rewrite | redemption rewrite — language-neutral structural detector, `notApplicable` without definitional intent |
| 9.5 | answer-engine/comparison-tables | answer-readiness | comparison-tables | move | |
| 9.6 | answer-engine/numbered-steps | answer-readiness | numbered-steps | move | grading pass: evidence duplicates semantic-lists (B) — candidate to fold during Plan 4 rewrites |
| 9.7 | answer-engine/specific-numbers | answer-readiness | specific-numbers | move | |
| 9.8 | answer-engine/dates-on-content | answer-readiness | dates-on-content | move | merge target for last-updated-indicator (9.10); C1/C16 clusters resolve via shared gatherer |
| 9.9 | answer-engine/content-without-clickthrough | answer-readiness | content-without-clickthrough | move | |
| 9.10 | answer-engine/last-updated-indicator | answer-readiness | dates-on-content | merge-away | §5: last-updated-indicator → dates-on-content |
| 9.11 | answer-engine/meta-description-aeo | answer-readiness | meta-description | merge-away | TODO(redeem) resolves as a merge into meta-description (4.1); the invented "AEO formula" is dropped |
| 10.1 | generative-engine/named-author | answer-readiness | named-author | move | C4 authors cluster via shared gatherer |
| 10.2 | generative-engine/author-same-as | answer-readiness | author-same-as | move | |
| 10.3 | generative-engine/author-page | answer-readiness | author-page | move | |
| 10.4 | generative-engine/about-credentials | answer-readiness | about-credentials | move | |
| 10.5 | generative-engine/external-citations | answer-readiness | external-citations | move | |
| 10.6 | generative-engine/brand-name | answer-readiness | brand-name | move | |
| 10.7 | generative-engine/trust-signals | answer-readiness | trust-signals | rewrite | redemption rewrite — grade B (252k-trial citation study, KDD'24 "Authoritative" effect) |
| 10.8 | generative-engine/review-signals | answer-readiness | review-signals | move | merge target for blockquote-usage (10.14); C8 reviews cluster via shared gatherer |
| 10.9 | generative-engine/publication-date | answer-readiness | publication-date | move | C1 dates cluster via shared gatherer |
| 10.10 | generative-engine/last-modified-schema | answer-readiness | last-modified-schema | move | C16 freshness cluster resolves via shared gatherer, not a merge |
| 10.11 | generative-engine/internal-cross-linking | machine-discovery | in-content-links | merge-away | decided 2026-08-21: merge-away into machine-discovery/in-content-links (1.15 is the surviving row) |
| 10.13 | generative-engine/unique-data | answer-readiness | unique-data | move | |
| 10.14 | generative-engine/blockquote-usage | answer-readiness | review-signals | merge-away | §5: blockquote-usage → review-signals |
| 10.15 | generative-engine/descriptive-urls | answer-readiness | descriptive-urls | move | decided 2026-08-21: confirmed — answer-readiness, informative tier |

## Summary

### Incoming audits per v2 category

| # | v2 category | incoming v1 audits |
| :- | :--- | ---: |
| 1 | access-crawl-control | 36 |
| 2 | content-extraction | 23 |
| 3 | machine-discovery | 22 |
| 4 | structured-data | 14 |
| 5 | answer-readiness | 32 |
| 6 | agent-interfaces | 22 |
| 7 | agentic-commerce | 3 |
| 8 | operability-safety | 29 |
| — | *sunset (no v2 home)* | 8 |
| | **total** | **189** |

Note: these are *incoming v1 rows*, not v2 audit counts — 24 rows merge away, 4 consolidate and
8 are sunset. Deduplicating the `category/slug` identities across the 181 non-sunset rows gives
**149 surviving v2 audits** from v1 (before the 83 proposed audits land); the plain row arithmetic
189 − 24 − 4 − 8 = 153 overstates it because several rows share one v2 target
(`access-crawl-control/ai-bot-directives` takes 5 rows, `answer-readiness/core-open-graph` 2,
`agent-interfaces/openapi-operation-ids` 2, `operability-safety/security-header-hygiene` 4).
Distinct v2 audits per category: access-crawl-control 29, answer-readiness 27, operability-safety 24,
content-extraction 21, machine-discovery 16, agent-interfaces 16, structured-data 13, agentic-commerce 3.
Cat 7 is thin because almost all of agentic-commerce comes from the ACP proposal set (§6), not from v1.

### Actions by count

| action | rows |
| :--- | ---: |
| move | 125 |
| rewrite | 26 |
| merge-away | 24 |
| consolidate | 4 |
| split | 2 |
| sunset | 8 |
| | **total** | **189** |

### merge-away rows (24)

| v1 id | v1 slug | absorbed into |
| :--- | :--- | :--- |
| 1.2 | llms-txt-blockquote | machine-discovery/llms-txt-structure (§5) |
| 1.3 | llms-txt-sections | machine-discovery/llms-txt-structure (§5) |
| 1.13 | no-noindex | access-crawl-control/robots-directives (decided 2026-08-21) |
| 1.22 | no-orphan-pages | machine-discovery/discovery-index-coverage (§5) |
| 3.4 | website-search-action | agent-interfaces/search-endpoint (decided 2026-08-21) |
| 3.23 | product-reviews | structured-data/review-schema (§5) |
| 4.3 | canonical-url | access-crawl-control/canonical (decided 2026-08-21) |
| 4.8 | og-site-name | answer-readiness/core-open-graph (§5) |
| 4.11 | llms-txt-link | machine-discovery/llms-txt-exists (C3 collapse) |
| 4.16 | rss-feed-link | machine-discovery/rss-feed (C3 collapse) |
| 4.18 | openapi-link | agent-interfaces/openapi-exists (TODO(redeem) → merge) |
| 4.19 | ai-catalog-link | agent-interfaces/ai-catalog-exists (TODO(redeem) + C3 collapse) |
| 4.20 | meta-robots | access-crawl-control/robots-directives (decided 2026-08-21) |
| 5.14 | mcp-capabilities | agent-interfaces/mcp-endpoint (§5) |
| 5.22 | webmcp-input-quality | operability-safety/form-actionability (§5) |
| 5.24 | webmcp-tool-annotations | agent-interfaces/mcp-endpoint (§5) |
| 6.13 | definition-elements | content-extraction/semantic-lists (§5) |
| 7.3 | nav-aria-label | operability-safety/landmark-unique (§5) |
| 8.11 | cache-headers | machine-discovery/ai-file-delivery (§5) |
| 8.12 | fast-response-time | content-extraction/server-responsiveness (decided 2026-08-21) |
| 9.10 | last-updated-indicator | answer-readiness/dates-on-content (§5) |
| 9.11 | meta-description-aeo | answer-readiness/meta-description (TODO(redeem) → merge) |
| 10.11 | internal-cross-linking | machine-discovery/in-content-links (decided 2026-08-21) |
| 10.14 | blockquote-usage | answer-readiness/review-signals (§5) |

### split rows (2)

| v1 id | v1 slug | halves |
| :--- | :--- | :--- |
| 3.8 | service-product-schema | Product half → structured-data/advanced-product-details · Service half → structured-data/service-schema (narrowed to Service/ProfessionalService) |
| 5.23 | webmcp-tool-naming | naming rule → agent-interfaces/openapi-operation-ids · runtime part → deferred future MCP tools/list check |

### consolidate rows (4)

All four fold into **operability-safety/security-header-hygiene** (§5, weight 0, never fails a site):

| v1 id | v1 slug |
| :--- | :--- |
| 8.2 | hsts-header |
| 8.3 | csp-header |
| 8.4 | content-type-options (nosniff also becomes a sub-signal of machine-discovery/ai-file-delivery) |
| 8.7 | security-txt |

### sunset rows (8)

Retired on 2026-08-21. They keep their row here for traceability but get no v2 `category/slug`.
The first four came out of the taxonomy review; the last four out of the evidence-grading pass the
same day (all grade D with no spec trajectory).

| v1 id | v1 slug | why |
| :--- | :--- | :--- |
| 1.18 | mobile-friendly | no proven consumer, viewport tag ubiquitous |
| 8.15 | image-dimensions | grade D CLS proxy, no agent consumer |
| 8.16 | lcp-not-lazy | grade D, `images[0]` is not an LCP proxy |
| 8.19 | privacy-policy | grade D generic trust claim; the ACP link-surface proposal covers the evidenced commerce case |
| 1.23 | commerce-links | grade D, no documented consumer |
| 7.22 | marquee (`_a11y.ts#deprecated-elements`) | grade D, mechanism proven false — marquee text is stable DOM text |
| 8.14 | no-render-blocking | grade D human-viewport performance signal, no agent consumer |
| 8.20 | terms-of-service | grade D, no documented consumer, English-only detector |

### Decisions (2026-08-21)

All 20 `REVIEW:` flags that this table carried are resolved; **0 open**. One line per decision.

| # | v1 id(s) | decision |
| :- | :--- | :--- |
| 1 | 1.18 mobile-friendly | **sunset** — no proven consumer, viewport tag ubiquitous |
| 2 | 8.15 image-dimensions | **sunset** — grade D CLS proxy, no agent consumer |
| 3 | 8.16 lcp-not-lazy | **sunset** — grade D, `images[0]` is not an LCP proxy |
| 4 | 8.19 privacy-policy | **sunset** — grade D generic trust claim; the ACP link-surface proposal covers the evidenced commerce case |
| 5 | 1.15 + 10.11 | **merge** → one rewritten `machine-discovery/in-content-links` (in-content links only); 1.15 survives, 10.11 merges away |
| 6 | 1.19 + 8.12 | **merge** → one `content-extraction/server-responsiveness` (median TTFB, banded); 1.19 survives, 8.12 merges away |
| 7 | 2.25 + 1.13 + 4.20 | **merge** → one `access-crawl-control/robots-directives` (all pages, meta + `X-Robots-Tag`, token-parsed); 2.25 survives, 1.13 and 4.20 merge away |
| 8 | 4.3 + 1.17 | **merge** → one `access-crawl-control/canonical` (resolved hrefs, homepage-collapse detection); 1.17 survives, 4.3 merges away |
| 9 | 3.4 + 5.16 | **merge** → `agent-interfaces/search-endpoint`, rewritten to read SearchAction array-safe and verify results; 5.16 survives, 3.4 merges away |
| 10 | 1.20 no-broken-links | **confirmed** machine-discovery |
| 11 | 2.28 agent-governance | **confirmed** access-crawl-control |
| 12 | 3.9 speakable-schema | **confirmed** structured-data |
| 13 | 3.21 product-identifiers | **confirmed** agentic-commerce (moved out of structured-data) |
| 14 | 5.15 contact-form | **confirmed** operability-safety |
| 15 | 5.18 no-blocking-captcha | **confirmed** operability-safety, form-scoped rewrite |
| 16 | 6.15 image-alt-text | **confirmed** content-extraction |
| 17 | 7.5 form-labels | **confirmed** slug `label` |
| 18 | 8.1 https-enabled | **confirmed** access-crawl-control, scored; judge the protocol after redirects |
| 19 | 8.18 no-broken-ai-endpoints | **confirmed** machine-discovery whole, no per-surface split; same-origin fix, drop the navigation.json source |
| 20 | 10.15 descriptive-urls | **confirmed** answer-readiness, informative tier |

Knock-on: 8.20 terms-of-service was left with its operability-safety home on its own merits when 8.19 was
sunset; the evidence-grading pass later the same day sunset it too (see below).

## Evidence grades (2026-08-21 pass)

Every registered v1 audit now carries an `evidence_grade` in its dossier under
[`docs/evidence/audits/`](audits/). Histogram over the 189 registered audits:

| grade | count |
| :--- | ---: |
| A | 80 |
| B | 47 |
| C | 49 |
| D | 12 |
| unrated | 1 |
| | **189** |

The single `unrated` is 1.18 mobile-friendly, which was already sunset-decided before the grading pass
ran, so it was never graded. The 12 grade-D audits dispose as: 3 earlier sunsets (8.15, 8.16, 8.19),
4 new sunsets from this pass (1.23, 7.22, 8.14, 8.20), 3 merge-away, 1 consolidation, and 4.13
ai-content-declaration kept at the experimental tier on an active declaration-spec trajectory.

(`docs/evidence/audits/` holds 207 dossiers in total; the 18 beyond the 189 registered rows cover
audits that are not in `audit-config.ts` and are excluded from the histogram above.)
