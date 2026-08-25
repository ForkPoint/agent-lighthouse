---
"@forkpoint/agent-lighthouse-core": major
---

A scan that gets HTTP 429 now reports a rate limit, not a bot wall.

`detectWafProtection` mapped 429 onto whichever provider fronted the site, so a
throttled scan came back as "Cloudflare Turnstile / Managed Challenge", and
`access-crawl-control/no-bot-detection` failed the site at critical priority
with "Bot-defense firewall detected blocking AI crawler connections". HTTP 429
means "too many requests" — a statement about the rate this scan asked at, not
about who the site admits.

Found by scanning 48 live Shopify storefronts back to back: 36 were reported as
behind a Cloudflare managed challenge, and a single-request `curl` carrying the
same user-agent got HTTP 200 from every one of them.

429 is now diagnosed before any provider is, since every provider serves it for
throttling. It carries `provider: 'rate-limited'` and a new `isRateLimit` flag,
and `no-bot-detection` returns not-applicable rather than failing — a scan that
never saw the site cannot judge its bot defenses.
