---
"@forkpoint/agent-lighthouse-core": patch
---

`agent-interfaces/openapi-servers` no longer fails an OpenAPI document that has no `servers` array, or an empty one. OpenAPI 3.0 and 3.1 both default it to a single server with url `/`, resolved against the document's location, so the base URL is derivable and the document passes. A `servers` value that is not an array now fails with its own message. The audit's description and fix advice no longer say a missing array makes the spec unusable.
