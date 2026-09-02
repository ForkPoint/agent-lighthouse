---
"@forkpoint/agent-lighthouse-core": patch
---

The origin cache is bounded and keyed by request headers. It sweeps expired entries on every write and drops the oldest when it holds more than `DEFAULT_ORIGIN_CACHE_MAX_ENTRIES` origins, so a long-lived process cannot grow it without limit. `computeOriginCacheKey` folds non-credential request headers into the key, so a scan with a bot user agent never reads what a default scan wrote. Credential headers still bypass the cache and never enter a key.
