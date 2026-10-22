---
"@forkpoint/agent-lighthouse-core": patch
---

Assess supplementary-content markup across all page types. Ignore hidden blocks, existing site-level navigation/header/footer containers, primary main containers and ambiguous widget or callout names. Skip candidates that hold one purchase-control group, such as a product buy box named `sidebar`. Keep the existing grade, tier and weight. Clarify that extractors can remove unmarked blocks through heuristics; missing aside markup does not prove extraction failure.

Keep repeated quick-add product rails eligible for supplementary markup. Distinguish exact checkout controls from newsletter prose. Assess blocks in article-scoped footers; skip blocks in any header, which holds introductory content such as a product promo badge. A buy box with a sale and original price, or with both add-to-cart and buy-it-now buttons, stays exempt. Apply the buy-box exemption only to `sidebar` names, so a sticky add-to-cart copy, an installment form or a second quantity field no longer turns a buy box into a rail. Skip badge classes such as `promo-tag` and blocks inside product cards. Skip announcement strips such as `promo-bar`, `promo-strip` and `newsletter-banner`, which are page banner content.
