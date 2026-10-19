---
"@forkpoint/agent-lighthouse-core": patch
---

UA parity audits now say what a User-Agent probe can prove. The scanner sends each bot's User-Agent from its own address, without the bot's published IP range or Web Bot Auth signature. A finding therefore reports how the site answers a request that names the bot, never that the real bot is blocked or sees a page. Reworded messages, titles and `details` strings in `access-crawl-control/ai-crawler-edge-parity`, `operability-safety/agent-ua-content-divergence-diff`, `access-crawl-control/bot-content-delta-declared`, `agentic-commerce/agent-ua-commerce-parity`, `agentic-commerce/cart-handoff-reachability` and `access-crawl-control/machine-actionable-402-paid-access`. Each dossier gains a Limits section citing Cloudflare's verified-bot and fake-bot rules, OpenAI's per-bot IP lists and Google's reverse-DNS verification. No id, tier, grade, weight, schema or verdict changed.
