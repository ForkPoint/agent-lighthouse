---
"@forkpoint/agent-lighthouse-core": patch
---

`machine-discovery/llms-txt-links-valid` checks at most 20 links from llms.txt, 4 at a time, instead of every link at once. A large llms.txt made the scan send hundreds of requests in a few seconds, and a site's WAF then refused the rest of the scan. Links that answer 401, 403 or 429, or do not answer, are now unverifiable instead of broken; redirects are followed before a link is judged; and the broken list names the right URLs. The audit is informative, so no score changes.
