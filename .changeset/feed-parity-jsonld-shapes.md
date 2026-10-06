---
"@forkpoint/agent-lighthouse-core": patch
---

Stop `machine-discovery/agent-commerce-feed-parity` reporting "no image" and "price undefined" on product pages that list images as an array or price a ProductGroup through an AggregateOffer or its variants. A seller given as an `@id` reference is now resolved on the page, and a reference to an undefined node is still reported.
