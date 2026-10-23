---
"@forkpoint/agent-lighthouse-core": patch
---

`agentic-commerce/ucp-profile-conformance` is now `notApplicable` instead of `warn` when a UCP profile names a protocol version the audit has no rules for, or names none. The warning blamed the site for the audit's own missing rules, and a missing version was already reported by `agentic-commerce/ucp-profile`. The audit is informative, so no score moves.
