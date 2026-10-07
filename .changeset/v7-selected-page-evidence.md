---
"@forkpoint/agent-lighthouse-core": major
---

Evaluate typed audits on declared and detected populations separately. Retain
informative `advisoryResults` beside the primary result without duplicating audit
weight. Check required page evidence against the selected URLs; exclude unread
body inputs from content verdicts while retaining them in `coverage`. Preserve
failed fetches in `pageAttempts` instead of losing them when parsing filters pages.

Sort audit input sets by URL. Emit one progress event and trace per registration,
including skipped audits. Preserve shared per-scan URL caches across population
views. Validate result coverage and advisory shapes; older reports can omit them.
Human report rendering and client controls follow in the next v7 stage.
