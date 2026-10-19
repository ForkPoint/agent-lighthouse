---
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-server": minor
---

Add `agent-lighthouse serve` and the new `@forkpoint/agent-lighthouse-server`
package: scans run as tasks, and their progress streams to a browser over
Server-Sent Events, with a JSON polling route as a fallback. Core emits a new
`phase:total` scan event when a phase's planned total changes.
