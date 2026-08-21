---
audit: structured-data/action-schema
category: structured-data
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# action-schema — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

In an end-to-end agentic checkout, the agent needs a machine-readable signal that the transaction actually completed rather than having to read a thank-you page in natural language. If a confirmation page carried a `ConfirmAction` or `ReserveAction` in its JSON-LD, an agent could verify success programmatically and close the loop without handing the user back to a manual confirmation screen.

## What we searched

Same constraint (WebSearch exhausted), so I worked from primary sources. I verified ConfirmAction and ReserveAction exist in schema.org (both HTTP 200; 1 occurrence each in the official vocabulary dump) and pulled their adoption figures. I then traced every agentic-checkout path that actually shipped: OpenAI/Stripe's Agentic Commerce Protocol site and OpenAI's product feed spec, Google's Actions Center / Maps Booking API routing in the LocalBusiness doc, and Google Media Actions' partner feed model. I checked the one place ConfirmAction is genuinely consumed — Gmail email markup — by fetching both the actions overview and the one-click-action reference. I also cloned Microsoft's NLWeb and grepped for ReserveAction/ConfirmAction/potentialAction, and queried arXiv for any research mentioning these action types. Finally I re-read the audit source to check whether its trigger (URL matching /thank-you|/confirmation|/success) could even be reached by a crawler, since those pages are typically post-POST and non-indexable.

## Best evidence found for the audit

ConfirmAction has exactly one verifiable, currently-documented consumer anywhere: Gmail. developers.google.com/workspace/gmail/markup/reference/one-click-action states 'One Click actions currently supported in Gmail are: ConfirmAction [and] SaveAction', with no deprecation notice. Critically, that is inside an email body and it means 'render a button the user clicks to confirm/approve' — the inverse of this audit's semantics ('this transaction already succeeded'). No web-page consumer exists. Adoption is the weakest of any signal I measured across all four audits: schema.org reports ConfirmAction at '< 1K Domains' (Google web index, July 2026); ReserveAction is 10K-100K.

## Counter-evidence

(1) Near-zero deployment: ConfirmAction < 1K domains worldwide (schema.org/ConfirmAction, July 2026 aggregation) — below the threshold at which any crawler would build a parser for it. (2) The real agentic-checkout standard deliberately does not use it: OpenAI/Stripe's Agentic Commerce Protocol handles completion over its own checkout API/MCP surface, and OpenAI's feed spec states 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path' — agents confirm via API response, never by scraping a thank-you page. (3) Google routes booking/order confirmation through the Maps Booking API per its LocalBusiness doc, and Media Actions through partner JSON feeds — neither reads confirmation-page markup. (4) Microsoft NLWeb: 0 occurrences of ConfirmAction, ReserveAction or potentialAction. (5) Apple's Applebot documents support for exactly one schema.org property, isAccessibleForFree. (6) arXiv full-text search returns zero papers mentioning potentialAction. (7) Mechanically self-defeating: the audit only fires on crawled URLs matching /thank-you|/confirmation|/success, which are post-transaction pages that are normally noindex'd, session-gated and unreachable by any crawler — so in practice this audit emits a low-priority warn on essentially every site scanned, which is noise rather than signal.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. The claimed mechanism does not correspond to how any shipping agentic-commerce system works: OpenAI/Stripe's ACP confirms transactions over an API/MCP surface and explicitly excludes semantic-markup sources, and Google routes reservations and orders through the Maps Booking API rather than page markup. Deployment is effectively nil (ConfirmAction < 1K domains globally). The single documented ConfirmAction consumer, Gmail one-click actions, is email markup with the opposite meaning — a button to trigger a confirmation, not a receipt that one occurred. The audit is also structurally inert, since confirmation pages are typically noindex and unreachable by a crawler, so it almost always degrades to a generic warn. Nothing here is redeemable; delete it.

## Sources

- **[schema.org: ConfirmAction](https://schema.org/ConfirmAction)** — schema.org (spec, URL verified 2026-08-21)
  - Type exists and is active, but usage is '< 1K Domains' based on Google's web index, July 2026 — the lowest adoption figure of any signal measured across these four audits. ReserveAction (https://schema.org/ReserveAction) shows 10K-100K domains.
- **[One Click Action reference (Gmail markup)](https://developers.google.com/workspace/gmail/markup/reference/one-click-action)** — Google Workspace (vendor-doc, URL verified 2026-08-21)
  - 'One Click actions currently supported in Gmail are: ConfirmAction [and] SaveAction.' Live, no deprecation notice. This is email-body markup meaning 'render a confirm button', not web-page markup asserting a completed transaction — adjacent to, not supportive of, the audit's claim.
- **[Agentic Commerce Protocol](https://www.agenticcommerce.dev/)** — OpenAI + Stripe (spec, URL verified 2026-08-21)
  - Completion/confirmation flows run through agent-facing endpoints ('Publish your checkout configuration with a traditional API or MCP') integrated with the merchant's commerce backend and payment processor. No schema.org, no confirmation-page markup.
- **[Product feed specification](https://developers.openai.com/commerce/specs/feed)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Requires tab- or comma-delimited flat files; 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' Confirms OpenAI's commerce stack does not consume JSON-LD of any kind.
- **[Local business (LocalBusiness) structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - For reservations and orders Google directs developers to the Maps Booking API, not to ReserveAction/ConfirmAction markup: 'you can use the Maps Booking API to enable bookings, payments, and other actions.'
- **[NLWeb repository grep for action types](https://github.com/nlweb-ai/NLWeb)** — Microsoft / nlweb-ai (repo, URL verified 2026-08-21)
  - Cloned and grepped: 'ConfirmAction' 0 files, 'ReserveAction' 0 files, 'OrderAction' 0 files, 'potentialAction' 0 files. Microsoft's schema.org-native agent framework ingests entity types (Recipe: 33 files, Product, Brand), not Actions.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
