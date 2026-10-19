---
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-server": minor
---

Add page detection to the task server. `POST /detect` reports a page's type, apart from a scan, from either a URL the server fetches once or a browser snapshot the client sends. The server keeps the payload in memory for 10 minutes, and `POST /tasks` with the returned `detectionId` scans that page without fetching the detected response again. `DELETE /detect/:id` drops a payload sooner. `POST /tasks` also accepts a plain `snapshot`. The new repeatable `serve --allow-origin <origin>` flag lets a browser extension call the server with CORS. Scan reports gain an optional `pageIdentity` field that records the detection a scan started from; a detected type stays `detected` and never changes scoring. Core adds `detectPage`, `PayloadOrigin`, and the `targetPage` and `pageIdentity` scan options.
