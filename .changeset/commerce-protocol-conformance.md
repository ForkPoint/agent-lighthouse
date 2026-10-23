---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

Add two informative commerce checks: an explicitly configured ACP sandbox checkout conformance probe and version-aware UCP capability and payment-handler declaration validation.

The ACP probe uses an environment-variable token reference, a fixed approved HTTPS API base URL, and the ACP 2026-04-17 contract. Normal scans do not run mutation probes. Configured probes never complete a purchase and attempt bounded cleanup of created test sessions. The CLI accepts the same opt-in through its configuration file.

The UCP check reads the existing public business-profile response. It checks declarations against the supported profile version without fetching merchant-supplied schemas or executing checkout requests. Both new audits have weight 0.
