---
"@forkpoint/agent-lighthouse-core": patch
---

`agent-interfaces/mcp-registry-listing-ownership` no longer fails a first-party registry listing because `/.well-known/mcp-registry-auth` is not served. The registry checks domain ownership at login by DNS TXT record or HTTP file and requires neither to stay published; a served but malformed file is now a warning.
