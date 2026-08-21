---
audit: agent-interfaces/website-search-action
audit_id: "3.4"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/website-search-action.ts
slug: website-search-action
review_verdict: fix
severity: high
evidence_grade: D
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# website-search-action (`3.4`)

> structured-data · source `website-search-action.ts` · review verdict **fix** · evidence grade **D** · disposition: **keep — fix required**

## What it checks

SearchAction tells AI agents how to search your site programmatically. When a user asks ChatGPT to "find X on yoursite.com", the agent uses this schema to construct a search URL. Without it, agents have no machine-readable way to query your content.

## Code review findings (2026-08-20, 11-agent pass)

Two concrete implementation bugs make this audit warn on correct markup: it casts `potentialAction` to a single object (breaking on the very common array form) and it requires `target` to be a string, rejecting the schema.org-canonical EntryPoint object. Compounding that, the signal itself is largely dead — Google retired the sitelinks search box in Nov 2023 and no LLM agent is known to construct search URLs from SearchAction — yet the audit is rated `high` priority with a fabricated claim about ChatGPT behaviour.

**Required fix:** Normalize `potentialAction` through `Array.isArray(a) ? a : [a]` and scan all WebSite nodes, not `[0]`. Accept `target` as either a string or an EntryPoint object (`target.urlTemplate`), and verify the placeholder name matches the `query-input` declaration rather than testing for a bare `{`. Drop `defaultPriority` to `low`, rewrite the description to stop asserting ChatGPT behaviour that has never been demonstrated, and consider `scoreDisplayMode: 'informative'`.

**False-positive risks:**
- `const action = ws['potentialAction'] as Record<string, unknown> | undefined;` with no array handling. When `potentialAction` is an array (WebSite commonly declares both a SearchAction and a ReadAction/ViewAction — Yoast, Rank Math and Squarespace all emit arrays), `matchesType(action, 'SearchAction')` reads `@type` off an Array, gets undefined, and the audit warns 'missing proper SearchAction' on correct markup. Both sibling audits (potential-action.ts:59, action-schema.ts:83) handle this with `Array.isArray(action) ? action : [action]`; this one does not.
- `typeof action['target'] === 'string' && action['target'].includes('{')` rejects the schema.org-preferred `"target": {"@type":"EntryPoint","urlTemplate":"https://…?q={search_term_string}"}`. The MORE correct markup fails while the looser string form passes — the audit inverts the quality gradient.
- `webSites[0]` only — a page emitting two WebSite nodes (theme + SEO plugin) is judged on whichever the flattener emits first.
- `.includes('{')` accepts any brace, so `"target": "https://site.com/search?q={}"` or a Handlebars artifact passes; it never verifies `query-input` declares the same parameter name, which is what actually makes the template resolvable.
- Because `allSchemas(ctx)` spans all pages, a WebSite node on an inner page satisfies a check declared `applicablePageTypes: ['homepage']`.

**Test gaps:**
- No test with `potentialAction` as an array — the highest-frequency false warn, and the sibling audits both have this test
- No test with `target` as an EntryPoint object with `urlTemplate`
- No test with two WebSite nodes on one page
- No test that `query-input` matches the template placeholder name
- No test for a non-homepage WebSite node

**Overlaps with:** `3.10`, `3.16`

## Evidence

### Signal: potentialAction / WebSite SearchAction — agent-executable actions declared in schema.org — grade D (structured-data)

**Mechanism:** An AI agent discovers a site capability declared as a schema.org potentialAction (e.g. WebSite/SearchAction, OrderAction, ReserveAction) and invokes it against the declared target/urlTemplate. No web-facing agent is known to do this; the one mainstream consumer of SearchAction was retired in 2024 and agentic action discovery has moved to MCP/ACP instead.

**Evidence:** This is the domain's clearest case of zombie adoption. SearchAction appears on 6.6M domains in JSON-LD — the fourth most common class by domain count in the Oct 2024 Common Crawl (webdatacommons-2024-stats) — yet its only mainstream consumer, Google's Sitelinks Search Box, was deprecated globally on 21 November 2024 for lack of use, along with its Search Console report and Rich Results Test highlighting (google-sitelinks-searchbox-farewell). Two consumers do exist and must be reported honestly. Apple's Applebot documentation lists SearchAction among supported schemas — but that page sits in Apple's Documentation Archive, predates Apple Intelligence, and Apple has published nothing since tying it to Siri's modern behaviour (apple-app-search-web-markup). And Gmail genuinely PARSES AND EXECUTES potentialAction: "One Click actions currently supported in Gmail are: ConfirmAction, SaveAction", wired through an HttpActionHandler url (google-gmail-one-click-action). That is a real invocation mechanism — in email, not on web pages, and not by an AI agent. Against the mechanism as stated, the evidence is decisive: Google's own agent-friendly guidance never mentions schema.org, describing agents as working from screenshots, DOM and the accessibility tree (web-dev-agent-friendly-sites), and the agentic-commerce specs define their own action surfaces with no schema.org reference (acp-feed-spec, openai-commerce-docs-index). Recommendation: delete this audit and repoint the slot at genuine action-discovery surfaces (MCP endpoints, ACP/agentic-checkout integration, stable and accessible DOM affordances).

**Counter-evidence:** Arguments for retaining it at informative rather than deleting: adoption is enormous (6.6M domains), the markup is harmless per Google's "unsupported structured data won't cause issues" guidance, and Applebot's archived support means a small chance Apple still parses it. NLWeb also proves the broader concept is alive — it exposes site data to agents over MCP using schema.org vocabulary (nlweb-github) — but it consumes schema.org DATA types, not Action declarations, so it does not rescue this signal. If the project prefers caution, downgrade to informative rather than delete; the grade stays D either way because no agent is documented executing a web-page potentialAction.
**Consumers:** none-known for web-page action execution, Gmail (ConfirmAction/SaveAction, email context only), Applebot (SearchAction, archived documentation) · **Recommended tier:** delete

**Sources:** [Farewell, Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box) · [Web Data Commons Extraction Report — October 2024 Common Crawl Corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) · [App Search Programming Guide: Mark Up Web Content](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html) · [One Click Actions — Gmail markup reference](https://developers.google.com/gmail/markup/reference/one-click-action) · [Build agent-friendly websites](https://web.dev/articles/ai-agent-site-ux) · [Product Feed Specification — Agentic Commerce Protocol](https://agentic-commerce-protocol.com/docs/commerce/specs/feed) · [Agentic Commerce documentation index](https://developers.openai.com/commerce/) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
