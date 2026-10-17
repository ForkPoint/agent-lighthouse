---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

Log lines say where they came from. Besides `site`, `scan` and `component`, each line now carries the scan `phase`, the `audit` whose run wrote it (also for the requests and gatherer work that audit started), and the `gatherer` whose shared work wrote it. Warn and error lines also carry `caller`, the source file and line. The CLI turns on source maps so `caller` names the source file, not the bundle. One `jq` query over a `--log-file` now shows which audit sent which requests.
