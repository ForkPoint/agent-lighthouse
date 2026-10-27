---
"@forkpoint/agent-lighthouse-core": patch
---

Stop reading probes with no HTTP response as site defects. A request the scheduler held back after a site paused the scan, a timeout or a transport failure is now reported as not assessed, with its cause, instead of "HTTP 0":

- `agentic-commerce/acp-policy-link-surface` no longer fails a policy link it never reached, and no longer claims checkout exclusion without a response from a hard-gate link.
- `agentic-commerce/agent-ua-commerce-parity` no longer warns that an agent "gets HTTP 0 where a browser got 200". A redirect loop still warns.
- `access-crawl-control/web-bot-auth-request-tolerance` returns not applicable when the signed request gets no response, instead of failing.
- `machine-discovery/sitemap-lastmod-verifiability` no longer counts unread sample pages, or pages that answered a non-200 status, as pages that publish no modification time.

Confirmed 404s, soft 404s, stub pages and pages without the expected content are still judged.
