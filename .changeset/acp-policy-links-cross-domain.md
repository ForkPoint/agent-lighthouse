---
"@forkpoint/agent-lighthouse-core": patch
---

`agentic-commerce/acp-policy-link-surface` no longer fails a policy link that lives on another domain or redirects to a PDF. The ACP link schema asks only for a URL, so a terms or privacy page hosted on a sister domain or served as a PDF now counts toward checkout eligibility.
