---
"@forkpoint/agent-lighthouse-core": patch
---

A scanned page with no readable text that names another page on its own origin through a meta refresh or a canonical link is now treated as a gateway, such as a splash or language-selection page. The scan reads that target once as a second page, so a site behind a gateway root is scored instead of reported as unscored. The gateway page keeps its own findings. A cross-origin target is never read, and the scan makes at most one hop. The CLI and config docs no longer claim that a scan discovers extra pages from the sitemap and navigation.
