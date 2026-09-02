---
"@forkpoint/agent-lighthouse-core": major
---

An informative check reports the score it measured. `toCheckResult` overwrote it with 0, so JSON and SDK consumers saw 0 for every informative check regardless of the measurement. `weight` stays 0 and keeps the check out of every sum; the score in the report changes.
