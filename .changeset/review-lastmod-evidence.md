---
"@forkpoint/agent-lighthouse-core": patch
---

Do not fail corroborated recent content edits as build stamps. Require page-date disagreement before reporting that pattern. A deploy-time Last-Modified header no longer vouches for a recent run of stamps; those URLs are unverifiable and warn.
