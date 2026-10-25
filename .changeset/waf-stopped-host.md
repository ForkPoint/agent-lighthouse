---
"@forkpoint/agent-lighthouse-core": patch
---

Bot-wall detection no longer reports a dropped connection when the request scheduler held the homepage back. When no vendor-specific diagnosis applies, a host stopped by a 403 on a root file now reports that file and status, for example `Target server rejected crawler with HTTP 403 on /robots.txt`. `ENETUNREACH` and `EHOSTUNREACH` are treated as network failures, not as a bot wall.
