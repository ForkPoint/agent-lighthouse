---
audit: structured-data/potential-action
audit_id: "3.10"
category: structured-data
source_file: packages/core/src/audits/structured-data/potential-action.ts
slug: potential-action
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# potential-action (`3.10`)

> structured-data · source `potential-action.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI agents use potentialAction to understand what actions users can take on your site (order, book, contact). This enables agentic workflows where ChatGPT or Claude can guide users directly to the right action URL instead of just describing your service.

## Code review findings (2026-08-20, 11-agent pass)

Hard-fails (binary, no na, medium priority) any site lacking a schema.org ContactAction/OrderAction/BookAction — three action types whose only consumers, Gmail Actions and Google's Order/Book-with-Google reservation programmes, have been shut down. Agentic commerce in 2026 runs on ACP, MCP and AP2, none of which read JSON-LD action types. Passing this changes no agent behaviour.

**Required fix:** Delete. If any residual value is wanted, fold the property check into 3.16 as a single informative (non-scoring) 'schema.org Actions declared' check with a union type list, and move the real agentic-action signal to the agent-tools category (MCP/OpenAPI/ACP surfaces), which is where 2026 agents actually look.

**False-positive risks:**
- `scoreDisplayMode: 'binary'` with no `notApplicable` branch: the overwhelming majority of sites have no ContactAction/OrderAction/BookAction anywhere, so this is a guaranteed score-0 check for nearly every scan, at medium priority, with 'AI agents cannot determine what actions users can take' guidance that is not true of any shipping agent.
- The accepted type list is arbitrary and excludes the action types with any residual pickup (`SearchAction`, `ViewAction`, `ReadAction`, `ReserveAction`, `BuyAction`, `SubscribeAction`). A site with a correct `ReserveAction` on its booking page fails here while passing 3.16 — the two audits check the same property with disjoint type lists and can disagree on identical markup.
- `allSchemas(ctx)` scans every node on every page, so a hoisted nested action anywhere satisfies the check for the whole site; conversely `applicablePageTypes: ['homepage','product']` is decorative since the audit reads all pages regardless.
- No validation that the action's `target` resolves to a real URL or that `EntryPoint`/`actionApplication` are usable — a `potentialAction` with a broken or relative target passes.

**Test gaps:**
- No test for a site with a valid `ReserveAction`/`BuyAction` (excluded by the arbitrary type list)
- No test that the action `target` is a resolvable URL
- No test justifying a hard fail for sites with no transactional surface
- No test demonstrating any agent-visible benefit of passing

**Overlaps with:** `3.16`, `3.4`

## Evidence

### Signal: potentialAction / WebSite SearchAction — agent-executable actions declared in schema.org — grade D (structured-data)

**Mechanism:** An AI agent discovers a site capability declared as a schema.org potentialAction (e.g. WebSite/SearchAction, OrderAction, ReserveAction) and invokes it against the declared target/urlTemplate. No web-facing agent is known to do this; the one mainstream consumer of SearchAction was retired in 2024 and agentic action discovery has moved to MCP/ACP instead.

**Evidence:** This is the domain's clearest case of zombie adoption. SearchAction appears on 6.6M domains in JSON-LD — the fourth most common class by domain count in the Oct 2024 Common Crawl (webdatacommons-2024-stats) — yet its only mainstream consumer, Google's Sitelinks Search Box, was deprecated globally on 21 November 2024 for lack of use, along with its Search Console report and Rich Results Test highlighting (google-sitelinks-searchbox-farewell). Two consumers do exist and must be reported honestly. Apple's Applebot documentation lists SearchAction among supported schemas — but that page sits in Apple's Documentation Archive, predates Apple Intelligence, and Apple has published nothing since tying it to Siri's modern behaviour (apple-app-search-web-markup). And Gmail genuinely PARSES AND EXECUTES potentialAction: "One Click actions currently supported in Gmail are: ConfirmAction, SaveAction", wired through an HttpActionHandler url (google-gmail-one-click-action). That is a real invocation mechanism — in email, not on web pages, and not by an AI agent. Against the mechanism as stated, the evidence is decisive: Google's own agent-friendly guidance never mentions schema.org, describing agents as working from screenshots, DOM and the accessibility tree (web-dev-agent-friendly-sites), and the agentic-commerce specs define their own action surfaces with no schema.org reference (acp-feed-spec, openai-commerce-docs-index). Recommendation: delete this audit and repoint the slot at genuine action-discovery surfaces (MCP endpoints, ACP/agentic-checkout integration, stable and accessible DOM affordances).

**Counter-evidence:** Arguments for retaining it at informative rather than deleting: adoption is enormous (6.6M domains), the markup is harmless per Google's "unsupported structured data won't cause issues" guidance, and Applebot's archived support means a small chance Apple still parses it. NLWeb also proves the broader concept is alive — it exposes site data to agents over MCP using schema.org vocabulary (nlweb-github) — but it consumes schema.org DATA types, not Action declarations, so it does not rescue this signal. If the project prefers caution, downgrade to informative rather than delete; the grade stays D either way because no agent is documented executing a web-page potentialAction.
**Consumers:** none-known for web-page action execution, Gmail (ConfirmAction/SaveAction, email context only), Applebot (SearchAction, archived documentation) · **Recommended tier:** delete

**Sources:** [Farewell, Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box) · [Web Data Commons Extraction Report — October 2024 Common Crawl Corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) · [App Search Programming Guide: Mark Up Web Content](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html) · [One Click Actions — Gmail markup reference](https://developers.google.com/gmail/markup/reference/one-click-action) · [Build agent-friendly websites](https://web.dev/articles/ai-agent-site-ux) · [Product Feed Specification — Agentic Commerce Protocol](https://agentic-commerce-protocol.com/docs/commerce/specs/feed) · [Agentic Commerce documentation index](https://developers.openai.com/commerce/) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/potential-action.md](../../deletions/structured-data/potential-action.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
