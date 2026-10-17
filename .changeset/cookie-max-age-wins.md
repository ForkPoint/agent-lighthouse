---
"@forkpoint/agent-lighthouse-core": patch
---

A redirect cookie with both `Max-Age` and `Expires` now follows `Max-Age`, as RFC 6265 says, whatever their order. A past `Expires` written after a positive `Max-Age` used to drop a cookie a browser keeps.
