---
"@forkpoint/agent-lighthouse-core": patch
---

Reduce heap held by one scan. Parsed HTML trees now store flat text and attribute strings instead of one rope piece per character, and crawler-UA response bodies in the per-scan probe cache stay compressed until an audit reads them. A 4 MB storefront homepage dropped from 480 MB to 195 MB of peak live heap with the same score.
