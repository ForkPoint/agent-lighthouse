---
"@forkpoint/agent-lighthouse-core": patch
---

`content-extraction/json-ld-duplication-mass` no longer counts a reference-only `{"@id"}` object as a duplicated node, and its warning names the duplicated nodes when no body text repeats.
