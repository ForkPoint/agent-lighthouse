---
"@forkpoint/agent-lighthouse-core": minor
---

Add opt-in exact-origin transport admission and optional per-hop request diagnostics. Keep origin waiting outside global, host and owner permits, preserve unknown and zero stream capacity, and expose live origin bounds alongside host queues. An owner's request held by a full origin no longer holds back its requests to another origin of the host, and idle origins at the default capacity are forgotten. Diagnostics listeners attach on first use, not at import, and cached origin evidence is reused only by scans with the same diagnostics and scheduler settings. Ready scans now complete the primary HTTP redirect chain and origin homepage before optional root probes. Legacy ordering, HTTP timing and replay remain compatible.
