---
"@forkpoint/agent-lighthouse-core": patch
---

Judge a bot wall from the pages the scan read. Root files count toward the WAF verdict only when the homepage itself failed, so a 403 on a missing `/.well-known/` file, a Cloudflare rule on one sitemap, or an Imperva path named in `robots.txt` no longer marks an open site as walled. A DataDome or Imperva marker counts only with a refusal status or on a page with no readable text, and "access denied" names Akamai only beside an Akamai header. An Akamai block page served with HTTP 200 is now detected, and its reason names a location refusal when the page says so. A homepage challenge is named before a root-file 429, and a vendor's own challenge before a bare Cloudflare 403. DNS, refused-port, TLS, certificate and connect-timeout failures are reported as an unreachable homepage instead of a bot wall. A multi-line OpenSSL error is reduced to one line, and a homepage that still answers a redirect after the fetcher's five-hop limit is reported as a redirect loop or a too-long chain.

An empty HTTP 428 on the homepage, which some apex redirectors send once a burst from one IP passes their limit, is now treated like a 429: the homepage fetch retries once after a pause, and a scan still limited after the retry is reported as throttled instead of as fetching no pages.
