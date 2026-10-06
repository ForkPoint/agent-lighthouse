---
"@forkpoint/agent-lighthouse-core": patch
---

`machine-discovery/websub-hub-advertisement` now reads `<atom:link rel="self">` and `rel="hub"` inside an RSS channel, under any prefix bound to the Atom namespace, and no longer counts an entry's own self link as a feed self link.
