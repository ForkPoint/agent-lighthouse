---
"@forkpoint/agent-lighthouse-core": patch
---

Stop printing `[object Object]` into evidence when a site publishes a malformed
non-string value. `openapi-exists` names the string version when `openapi` is
an object beside a string `swagger`. `mcp-discovery` reads an object UCP
`version` as unversioned. `json-ld-duplication-mass` names a duplicated node
with an object `@type` as `node`.
