---
audit: structured-data/action-schema
category: structured-data
audit_id: "3.16"
source_file: packages/core/src/audits/structured-data/action-schema.ts
slug: action-schema
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
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

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/structured-data/action-schema.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users in agentic workflows. Without this schema on your confirmation pages, agents cannot programmatically verify that a booking or purchase was successful.

### Code review findings (2026-08-20, 11-agent pass)

Gated on the crawler having fetched a thank-you/confirmation page — post-checkout, noindex, unlinked pages a crawler essentially never reaches — so on virtually every scan it returns the 'no confirmation pages' branch, which is warn (0.5) rather than na. Net effect: a fixed unearned half-point deduction carrying zero information, for a schema.org action type no 2026 agent consumes. When it does fire, the URL regex matches marketing pages.

**Required fix:** Delete. The audit is unreachable in practice, its default branch is an unearned deduction, its URL regex misfires on marketing pages, and the standard it checks has no consumer. If post-purchase agent verification is worth auditing at all, it belongs in agent-tools as a check for a machine-readable order/receipt API, not as JSON-LD on a page a crawler cannot reach.

**False-positive risks:**
- `isConfirmationUrl` requires a scanned page URL matching `/thank-you|/confirmation|/success|/order-complete/`. Those pages sit behind checkout, are `noindex`, are not in sitemaps, and are not linked from any crawlable page — so the crawler will essentially never sample one. The audit therefore returns the same `warn` (0.5) on nearly every site, for nearly every scan, regardless of the site's actual quality. An audit whose output is constant carries no information but still costs the customer score.
- `/\/(thank-?you|confirmation|success|order-complete)\b/i` matches `/success-stories/`, `/customer-success/`, `/our-success`, `/client-success-stories` — extremely common B2B marketing URLs. When the crawler samples one, the audit hard-`fails` it for lacking ConfirmAction schema on a case-study page. Concrete false fail.
- Non-English confirmation paths (`/danke`, `/merci`, `/gracias`, `/bedankt`, `/spasibo`) never match, so even the rare site whose confirmation page IS reachable is skipped if it is not English.
- The precondition-absent branch uses `this.warn(...)` where the base class documents `notApplicable` for exactly this case.
- Overlaps 3.10: both check `potentialAction` with adjacent-but-disjoint type lists, so identical markup can pass one and fail the other.

**Test gaps:**
- No test for `/success-stories/` or `/customer-success/` being wrongly treated as a confirmation page
- No test for non-English confirmation paths
- No test acknowledging that confirmation pages are unreachable by a crawler (the always-warn reality)
- No test asserting the no-confirmation-pages branch should be `na` rather than `warn`

**Overlaps with:** `3.10`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/structured-data/action-schema.md`; that copy removed (one dossier per removed audit, under `sunset/`).
