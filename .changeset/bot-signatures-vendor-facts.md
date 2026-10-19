---
"@forkpoint/agent-lighthouse-core": patch
---

Bot facts now follow the vendors' own crawler pages (re-checked 2026-10-19).

- The UA-parity probes send OAI-SearchBot as the string OpenAI documents (`… Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot`), not a bare `OAI-SearchBot/1.0`. The browser baseline moves from Chrome 140 to the current Stable major, 155. The ClaudeBot and Claude-User strings are kept and are now recorded as observed: Anthropic publishes no User-Agent string.
- The robots.txt crawler tables read by `access-crawl-control/agent-governance` and `access-crawl-control/ai-usage-signal-coherence-across-channels` changed. Anthropic's training crawler is `ClaudeBot`; the undocumented `anthropic-ai` token no longer counts. PerplexityBot and YouBot are search crawlers, not training crawlers, and Diffbot is neither. `Bravebot` is dropped, because Brave documents no distinct user agent. The documented tokens Perplexity-User, Meta-WebIndexer, Amzn-SearchBot, Amzn-User, MistralAI-Index and MistralAI-Training are added.
- Some sites' verdicts move. A robots.txt that names only `anthropic-ai` no longer counts as naming a training crawler. A PerplexityBot, YouBot or Diffbot block no longer reads as a training opt-out. A site that blocks one of the newly listed training tokens, or names one of the new live tokens, can now be credited for it.
- `agent-governance` no longer says a category has no rules when both are named but too thinly to count.
- The `no-bot-detection` fix text lists ClaudeBot and Perplexity-User. It no longer lists `anthropic-ai`, `Bravebot` or `Google-Extended`, none of which is a user agent a vendor sends.
- The unused `isAnthropicAllowed` helper is removed. It was never part of the public API.
