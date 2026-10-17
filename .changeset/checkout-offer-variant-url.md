---
"@forkpoint/agent-lighthouse-core": patch
---

`agentic-commerce/checkout-offer-field-mapping` no longer fails a product page whose Product `url` differs from its canonical link. The OpenAI product feed spec asks for the product page with the variant selected, so a variant URL whose canonical names the parent product is now a valid row.
