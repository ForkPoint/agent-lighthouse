---
"@forkpoint/agent-lighthouse-core": patch
---

Two audits now describe what they check. `agentic-commerce/checkout-offer-field-mapping` said it audits each product page; it judges the first scanned product page with `Product` markup, and its description and expected text now say so. `machine-discovery/rss-feed` named three conventional feed paths in its messages; the scan probes five (`/feed`, `/feed.xml`, `/rss.xml`, `/atom.xml`, `/index.xml`), and the messages now list them all. No verdict changes.
