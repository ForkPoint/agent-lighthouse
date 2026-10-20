---
"@forkpoint/agent-lighthouse-core": patch
---

A refusal of a spoofed bot User-Agent now warns instead of failing. The scanner sends each bot's User-Agent from its own address, so it is never the verified bot, and Cloudflare (Super Bot Fight Mode, `cf.client.bot`) and Anubis document rules that refuse unverified traffic while admitting the verified bot. Answers that say something about the site, whoever asks, still fail.

- `access-crawl-control/ai-crawler-edge-parity`: a Cloudflare challenge, a proof-of-work wall, a 200 challenge page and any non-2xx where a browser got 200 now warn, like an opaque 403 already did. A pay-per-crawl 402 with a price and a soft block with no challenge in it still fail.
- `agentic-commerce/agent-ua-commerce-parity`: a challenge marker, a 403, 429 or 503 and any other non-2xx now warn at Medium instead of failing at Critical. This matches edge parity. A stub page, a priced 402 and a robots.txt disallow still fail.
- `agentic-commerce/cart-handoff-reachability`: a 403 or 429 to the ChatGPT-User request, and a challenge page or widget served only to it while a browser gets the cart, now warn. A ChatGPT-User refusal is compared only where the browser got a 2xx. A wall the browser gets too still fails.
- `access-crawl-control/bot-content-delta-declared`: a reduced page now triggers one control fetch as an unrecognised bot. If the control bot gets the same reduction, the delta is bot management and warns. A delta keyed on the crawler's name still fails. A thin 200 carrying a challenge marker is no longer compared.

Dossiers are updated with the sources, verified 2026-10-20. No id, tier, grade, weight or schema changed.
