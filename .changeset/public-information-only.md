---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Remove the credentialed `agentic-commerce/acp-endpoint-conformance-probe` audit and the `acpSandbox` library/CLI configuration. Remove the `AcpSandboxConfig` and `AcpSandboxConfigSchema` exports and private-probe fetcher option. These interfaces required merchant credentials and checkout mutations, which do not fit the public-information-only scanner.

Public ACP storefront checks and UCP profile checks remain. Preserve the withdrawn audit's evidence under `docs/evidence/sunset/`.
