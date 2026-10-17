---
"@forkpoint/agent-lighthouse-core": patch
---

A gateway homepage with no readable text is now followed to its `www` or apex twin, not only to a target on the same origin. A site whose apex page is only a meta refresh to `https://www.<site>` was left unscored; it is now read at the target, as a browser would. Other hosts, other schemes and other ports are still not followed.
