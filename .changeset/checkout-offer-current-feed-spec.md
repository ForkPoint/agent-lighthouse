---
"@forkpoint/agent-lighthouse-core": patch
---

`agentic-commerce/checkout-offer-field-mapping` now follows the current OpenAI product feed spec. It no longer fails a product for an item_id over 100 or a brand over 70 characters, for having neither a GTIN nor an MPN, for a pre-order without a date, or for an HTTP image or product URL; those rules are gone from the spec or apply only to its Google-compatible profile.
