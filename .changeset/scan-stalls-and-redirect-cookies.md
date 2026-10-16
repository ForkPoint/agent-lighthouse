---
"@forkpoint/agent-lighthouse-core": patch
---

Fix scan stalls and redirect handling found in a full corpus run.

- `content-extraction/hydration-payload-share` reads payload strings in one pass. A payload cut inside a string literal made the old regex run for tens of seconds, blocking every scan in the process, and read no strings. The open literal is now read up to the cut.
- `operability-safety/invisible-instruction-scan` judges each element's hiding once per page and matches only rules that can hide text. No verdict changes; large pages no longer take seconds.
- The fetcher sends cookies set along one redirect chain back on its later hops and follows up to 20 redirects, as browsers do. Sites that redirect until their locale or session cookie returns now load. The jar lives for one fetch only.
- A homepage chain that ends on a storefront challenge route (`PX-Show`, `DDUser-Challenge`) is reported as a PerimeterX or DataDome wall instead of a bare HTTP status.
