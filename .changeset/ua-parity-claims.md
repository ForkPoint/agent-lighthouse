---
"@forkpoint/agent-lighthouse-core": patch
---

UA parity audits now say what a User-Agent probe can prove. The scanner sends each bot's User-Agent from its own address, without the bot's published IP range or Web Bot Auth signature. A finding therefore reports how the site answers a request that names the bot, never that the real bot is blocked or sees a page. Reworded messages, titles and `details` strings in `access-crawl-control/ai-crawler-edge-parity`, `operability-safety/agent-ua-content-divergence-diff`, `access-crawl-control/bot-content-delta-declared`, `agentic-commerce/agent-ua-commerce-parity`, `agentic-commerce/cart-handoff-reachability` and `access-crawl-control/machine-actionable-402-paid-access`. Each dossier gains a Limits section citing Cloudflare's verified-bot policy, OpenAI's per-bot IP lists and, as an illustration, Google's reverse-DNS verification.

One verdict is corrected: `access-crawl-control/ai-crawler-edge-parity` no longer fails a URL where the browser itself got a non-2xx, such as a stale sitemap URL that answers 404 to everyone. Its dossier already required the browser request to be 200. Such URLs are now named in `found` as not compared. No id, tier, grade, weight or schema changed.
