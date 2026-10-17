---
"@forkpoint/agent-lighthouse-core": patch
---

`agent-interfaces/openapi-operation-ids` now credits its 64-character operationId limit to OpenAI, whose API reference sets it, instead of Anthropic, which now allows 128. Verdicts do not change.
