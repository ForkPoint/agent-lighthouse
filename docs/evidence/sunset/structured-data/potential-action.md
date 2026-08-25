---
audit: structured-data/potential-action
category: structured-data
audit_id: "3.10"
source_file: packages/core/src/audits/structured-data/potential-action.ts
slug: potential-action
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# potential-action — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

An agent that can read a machine-readable list of the actions a site affords (order here, book here, contact here) can deep-link a user straight to the transactional endpoint instead of paraphrasing the page. schema.org `potentialAction` with an action type and a `target` URL is the pre-existing vocabulary for exactly that, so if any assistant — Google, ChatGPT, Copilot, Claude — parsed it during crawl, marking it up would convert AI referrals into completed actions.

## What we searched

With WebSearch exhausted I attacked this through vendor primary sources and the vocabulary itself. First I validated the audit's own accepted types against schema.org: I curl-checked HTTP status for each type and then downloaded the official vocabulary dump (schema.org/version/latest/schemaorg-current-https.jsonld, 1.5 MB) and grepped it. I then walked every plausible consumer: Google's LocalBusiness structured-data doc (what it says to do for ordering/booking), Google's Actions Center and Media Actions docs, Google's changelog entry for the sitelinks search box (the one feature that ever consumed potentialAction at web scale), the Gmail email-markup Action references, OpenAI/Stripe's Agentic Commerce Protocol site and OpenAI's product feed spec, Apple's Applebot page, and Microsoft's NLWeb repository (cloned and grepped). Finally I queried the arXiv API for any paper mentioning 'potentialAction' at all.

## Best evidence found for the audit

Weak and adjacent. The strongest real consumer of schema.org Action types I could verify is Gmail email markup: developers.google.com/workspace/gmail/markup/reference/one-click-action states 'One Click actions currently supported in Gmail are: ConfirmAction [and] SaveAction' — live, no deprecation notice. That is email-body markup, not web-page potentialAction. Secondarily, the Actions vocabulary is not abandoned upstream: schema.org release 29.4 (2025-12-08) added AuthenticateAction, LoginAction and ResetPasswordAction, and potentialAction shows 10M+ domains (July 2026) — though that figure is overwhelmingly boilerplate WebSite/SearchAction emitted by CMS plugins for a Google feature that no longer exists. No vendor, anywhere, documents an agent reading potentialAction from a web page.

## Counter-evidence

Positive proof on several fronts. (1) THE AUDIT'S OWN TYPES ARE PARTLY INVENTED: `ContactAction` and `BookAction` are not schema.org types. https://schema.org/ContactAction and https://schema.org/BookAction both return HTTP 404, and the official vocabulary dump contains 0 occurrences of schema:ContactAction and 0 of schema:BookAction (vs. 2 for schema:OrderAction). Two of the three types this audit accepts as a PASS — and names in its user-facing fix guidance — do not exist, so the audit can green-light invalid markup and instruct users to publish nonexistent vocabulary. (2) Google killed the only web-scale potentialAction consumer: 'The sitelinks search box feature is no longer available in Google Search results' — documentation removed 2024-11-29 (developers.google.com/search/updates#bye-sitelinkbox). (3) Google explicitly routes ordering/booking away from markup: its LocalBusiness doc says 'If you want to help users to make a reservation or place an order directly in Search results, you can use the Maps Booking API' — an API integration, not potentialAction. (4) Google Media Actions is a partner-only JSON *feed* program ('a feed, a JSON object containing schema.org entities'; 'Google is working with a limited number of providers at a time'), not page markup. (5) Google sunset Conversational Actions on 2023-06-13. (6) OpenAI/Stripe's Agentic Commerce Protocol does not use schema.org at all, and OpenAI's feed spec explicitly excludes it: 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path' — merchants upload tab/comma-delimited flat files. (7) Apple's Applebot supports exactly one schema.org property, isAccessibleForFree. (8) Microsoft's NLWeb repo: 0 occurrences of 'potentialAction', 'OrderAction' or 'ReserveAction'. (9) arXiv full-text search for 'potentialAction' returns zero papers.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. Not a single documented consumer reads potentialAction from a web page, and every vendor that actually built an agentic ordering/booking path — Google (Maps Booking API, Actions Center feeds), OpenAI/Stripe (ACP flat-file feeds plus checkout API), Apple (isAccessibleForFree only), Microsoft (NLWeb, zero references) — chose APIs or feeds over page markup, in two cases explicitly excluding it. The one feature that ever consumed potentialAction at scale, the sitelinks search box, was removed by Google on 2024-11-29. On top of that the implementation is independently broken: 2 of its 3 accepted types (ContactAction, BookAction) are not schema.org vocabulary at all — confirmed by 404s and by 0 hits in the official vocabulary dump — so the audit both passes invalid markup and tells users to emit nonexistent types. This is speculative signal plus a factual defect; delete it. (Note the sibling audit website-search-action.ts, which checks SearchAction, warrants the same scrutiny — Google removed that feature in Nov 2024.)

## Sources

- **[schema.org current vocabulary (schemaorg-current-https.jsonld)](https://schema.org/version/latest/schemaorg-current-https.jsonld)** — schema.org (spec, URL verified 2026-08-21)
  - Downloaded (1.5 MB) and grepped. schema:ContactAction = 0 occurrences. schema:BookAction = 0 occurrences. schema:OrderAction = 2. schema:ReserveAction = 1. schema:ConfirmAction = 1. Confirms ContactAction and BookAction are not schema.org types; https://schema.org/ContactAction and https://schema.org/BookAction both return HTTP 404.
- **[Google Search documentation updates — sitelinks search box removed](https://developers.google.com/search/updates#bye-sitelinkbox)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - 2024-11-29: 'Removed sitelinks search box documentation and archived the nositelinkssearchbox rule' — 'The sitelinks search box feature is no longer available in Google Search results.' The former doc URL 301s to this anchor. This was the only web-scale consumer of potentialAction.
- **[Local business (LocalBusiness) structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Contains no potentialAction / OrderAction / ReserveAction guidance. Instead: 'If you want to help users to make a reservation or place an order directly in Search results, you can use the Maps Booking API to enable bookings, payments, and other actions.' Google routes actions through an API, not markup.
- **[Media Actions](https://developers.google.com/actions/media)** — Google (vendor-doc, URL verified 2026-08-21)
  - Feed-based and partner-gated: providers submit 'a feed, a JSON object containing schema.org entities representing items in your media catalog', and 'Google is working with a limited number of providers at a time to integrate each provider into the feature.' Not page-level potentialAction consumption.
- **[Product feed specification](https://developers.openai.com/commerce/specs/feed)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Merchants must 'Upload a UTF-8, tab-delimited .txt or .tsv file, or a comma-delimited .csv file.' Explicitly: 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' OpenAI's agentic commerce ingestion path excludes JSON-LD/schema.org entirely.
- **[Agentic Commerce Protocol](https://www.agenticcommerce.dev/)** — OpenAI + Stripe (spec, URL verified 2026-08-21)
  - 'An open standard for programmatic commerce flows between buyers, AI agents, and businesses.' Merchants 'Publish your checkout configuration with a traditional API or MCP'. No schema.org markup, no JSON-LD, no potentialAction anywhere in the protocol.
- **[Conversational Actions sunset](https://developers.google.com/assistant/ca-sunset)** — Google Assistant developers (announcement, URL verified 2026-08-21)
  - 'Google is sunsetting Conversational Actions on June 13, 2023, which means these custom experiences for Google Assistant users will no longer be available to users or developers.'
- **[schema.org: potentialAction](https://schema.org/potentialAction)** — schema.org (spec, URL verified 2026-08-21)
  - Active, not deprecated. 10M+ domains (Google web index, July 2026) — but dominated by CMS-emitted WebSite/SearchAction boilerplate for the now-removed sitelinks search box. OrderAction: 10K-100K domains. ReserveAction: 10K-100K domains.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/structured-data/potential-action.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI agents use potentialAction to understand what actions users can take on your site (order, book, contact). This enables agentic workflows where ChatGPT or Claude can guide users directly to the right action URL instead of just describing your service.

### Code review findings (2026-08-20, 11-agent pass)

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

### Evidence

#### Signal: potentialAction / WebSite SearchAction — agent-executable actions declared in schema.org — grade D (structured-data)

**Mechanism:** An AI agent discovers a site capability declared as a schema.org potentialAction (e.g. WebSite/SearchAction, OrderAction, ReserveAction) and invokes it against the declared target/urlTemplate. No web-facing agent is known to do this; the one mainstream consumer of SearchAction was retired in 2024 and agentic action discovery has moved to MCP/ACP instead.

**Evidence:** This is the domain's clearest case of zombie adoption. SearchAction appears on 6.6M domains in JSON-LD — the fourth most common class by domain count in the Oct 2024 Common Crawl (webdatacommons-2024-stats) — yet its only mainstream consumer, Google's Sitelinks Search Box, was deprecated globally on 21 November 2024 for lack of use, along with its Search Console report and Rich Results Test highlighting (google-sitelinks-searchbox-farewell). Two consumers do exist and must be reported honestly. Apple's Applebot documentation lists SearchAction among supported schemas — but that page sits in Apple's Documentation Archive, predates Apple Intelligence, and Apple has published nothing since tying it to Siri's modern behaviour (apple-app-search-web-markup). And Gmail genuinely PARSES AND EXECUTES potentialAction: "One Click actions currently supported in Gmail are: ConfirmAction, SaveAction", wired through an HttpActionHandler url (google-gmail-one-click-action). That is a real invocation mechanism — in email, not on web pages, and not by an AI agent. Against the mechanism as stated, the evidence is decisive: Google's own agent-friendly guidance never mentions schema.org, describing agents as working from screenshots, DOM and the accessibility tree (web-dev-agent-friendly-sites), and the agentic-commerce specs define their own action surfaces with no schema.org reference (acp-feed-spec, openai-commerce-docs-index). Recommendation: delete this audit and repoint the slot at genuine action-discovery surfaces (MCP endpoints, ACP/agentic-checkout integration, stable and accessible DOM affordances).

**Counter-evidence:** Arguments for retaining it at informative rather than deleting: adoption is enormous (6.6M domains), the markup is harmless per Google's "unsupported structured data won't cause issues" guidance, and Applebot's archived support means a small chance Apple still parses it. NLWeb also proves the broader concept is alive — it exposes site data to agents over MCP using schema.org vocabulary (nlweb-github) — but it consumes schema.org DATA types, not Action declarations, so it does not rescue this signal. If the project prefers caution, downgrade to informative rather than delete; the grade stays D either way because no agent is documented executing a web-page potentialAction.
**Consumers:** none-known for web-page action execution, Gmail (ConfirmAction/SaveAction, email context only), Applebot (SearchAction, archived documentation) · **Recommended tier:** delete

**Sources:** [Farewell, Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box) · [Web Data Commons Extraction Report — October 2024 Common Crawl Corpus](https://webdatacommons.org/structureddata/2024-12/stats/stats.html) · [App Search Programming Guide: Mark Up Web Content](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html) · [One Click Actions — Gmail markup reference](https://developers.google.com/gmail/markup/reference/one-click-action) · [Build agent-friendly websites](https://web.dev/articles/ai-agent-site-ux) · [Product Feed Specification — Agentic Commerce Protocol](https://agentic-commerce-protocol.com/docs/commerce/specs/feed) · [Agentic Commerce documentation index](https://developers.openai.com/commerce/) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/structured-data/potential-action.md`; that copy removed (one dossier per removed audit, under `sunset/`).
