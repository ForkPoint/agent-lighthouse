---
"@forkpoint/agent-lighthouse-core": minor
---

Bound HTTP page DOM analysis with the same depth limit as browser snapshots, exported as `DOM_WORK_LIMITS`. The depth check runs while the parser builds the tree, because HTML parsing slows quadratically with depth. The DOM check runs before structured-data extraction, page classification, accessibility analysis, and audits. Served pages get a larger ancestor-work allowance than one browser capture. Report excluded pages as unread analysis inputs while preserving their actual HTTP status and access evidence. Keep other usable pages and name analysis-limit reasons rather than reporting missing site content. Audits that fetch a page again under another user agent parse it within the same limits. A challenge or status verdict on such a response survives a body over the limits.

Detect Akamai connection drops from response evidence only. A target hostname no longer implies a bot-protection verdict.
