---
audit: structured-data/potential-action
category: structured-data
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
