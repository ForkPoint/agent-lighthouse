---
"@forkpoint/agent-lighthouse-core": patch
---

Product pages with a recommendation rail are detected as product pages again.

- A page's own product evidence (`og:type=product`, one top-level product entity, or a buy control outside listing cards) now outranks a product grid.
- One top-level `Product`, `ProductGroup`, `IndividualProduct` or `ProductModel` entity, in JSON-LD, microdata or RDFa, is strong product evidence. The new signal is `product-schema-primary`. Several top-level products, or listing schema beside them, stay a hint. Beside a grid of three or more product cards, one product entity is also only a hint: a collection page often declares one `Product` with an `AggregateOffer`, and it stays a category page.
- Product cards count once: parts that repeat the card class (`product-tile-image`) no longer add cards. Cards in recommendation, recently viewed and carousel regions do not count toward a grid. `<html>`, `<body>` and `<main>` are never read as such a region, so a theme class such as `has-slider` on `<body>` does not hide the page's own buy controls.
- Carousel dots (`swiper-pagination`) no longer count as result pagination.
- Buy buttons and prices inside listing cards no longer count as the page's own purchase controls. Once a page has two or more product cards, each is a listing card however deeply it is wrapped, and so is every card in a recommendation region. A lone element marked `data-product-id`, or a card that holds the page's `<h1>`, is the page's own product and keeps its controls.
