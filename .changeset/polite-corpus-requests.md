---
"@forkpoint/agent-lighthouse-core": minor
---

Add an optional caller-provided request scheduler across scans and redirect hops. Hold the shared slot until the response body finishes. Exclude queue time from request timing while retaining it in the scan budget. Scheduler implementations define pacing and refusal policy outside the engine.

Fetch the scanned page immediately after robots.txt, before the other root-file probes, to obtain the main evidence earlier.
