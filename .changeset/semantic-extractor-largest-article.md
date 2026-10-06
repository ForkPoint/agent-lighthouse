---
"@forkpoint/agent-lighthouse-core": patch
---

The semantic extractor behind `content-extraction/extraction-determinism` now reads the `<article>` with the most text, not the first one. When no article holds at least a fifth of the page's text, it falls back to the body. A promo strip marked up as the page's first `<article>` no longer reads as the page.
