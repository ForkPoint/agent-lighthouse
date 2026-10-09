---
"@forkpoint/agent-lighthouse-core": patch
---

Product audits read `ProductGroup` markup the way Google documents it.

- A new shared reader, `resolveProducts`, returns each `hasVariant` entry, and each Product joined through `isVariantOf` or `inProductGroupWithID`, with the group's shared properties beneath its own. A `ProductGroup` with no variants is read as the product.
- `offer-schema`, `product-identifiers`, `advanced-product-details`, `product-transaction-certainty`, `checkout-offer-field-mapping` and the product field summary use it. A brand or category declared once on the group is no longer missed.
- `offer-schema` no longer judges only the first `Offer` node in the page. Any priced offer reachable from the page's products passes, including an `AggregateOffer` with `lowPrice` and an `Offer` that names its product through `itemOffered`, nested or by `@id`.
- `checkout-offer-field-mapping` reads an `image` list by its first URL instead of reporting "no image".
- `@id` references are followed: a `hasVariant` entry or an `offers` value given as `{"@id": ...}` is read as the node it names.
- `landed-cost-and-returns` reads microdata and RDFa products, as its dossier states, and takes the page's own product offer before any other `Offer` node.
