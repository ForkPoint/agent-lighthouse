---
"@forkpoint/agent-lighthouse-core": patch
---

Require primary product cards before pagination and filters can suggest a product category. Editorial indexes, such as a captured furniture-retailer blog index, no longer receive a category hint from generic navigation controls alone. On such a page `operability-safety/url-addressable-state-and-pagination-fallback` now reports not applicable instead of pass, because the page is no longer classified as a category. A client-rendered listing whose served HTML has an empty product grid container still receives the hint.
