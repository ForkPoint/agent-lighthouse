---
"@forkpoint/agent-lighthouse-core": patch
---

Stop treating a Cloudflare Turnstile loader on a readable page as a bot wall. `agentic-commerce/cart-handoff-reachability` fails only a cart that is a challenge page or only a widget, `access-crawl-control/no-bot-detection` passes a loader on a page the scan could read, and `operability-safety/no-blocking-captcha` matches widget scripts and markup instead of any mention of the vendor name.
