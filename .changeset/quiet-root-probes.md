---
"@forkpoint/agent-lighthouse-core": patch
---

Return an unverified, not-applicable root-text resolution result when HTTP evidence is incomplete instead of treating status zero or failed requests as site defects. Keep failures supported by received HTTP responses and prevent incomplete probe sets from passing.
