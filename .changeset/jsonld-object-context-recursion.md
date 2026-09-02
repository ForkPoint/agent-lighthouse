---
"@forkpoint/agent-lighthouse-core": patch
---

Audits no longer throw on a page whose JSON-LD carries an object-valued `@context` (`{ "@vocab": "https://schema.org/" }`). The deep node walk inherited that object into every child, then walked into it and stamped it with itself, recursing until the stack ran out. Two audits reported `[scanner] Audit error` on zapier.com instead of a result. The walk now treats `@context` as a vocabulary, not a node.
