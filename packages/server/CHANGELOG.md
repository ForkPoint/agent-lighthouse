# @forkpoint/agent-lighthouse-server

## 9.1.1

### Patch Changes

- Updated dependencies [553713d]
- Updated dependencies [d78c3a1]
- Updated dependencies [88dce89]
  - @forkpoint/agent-lighthouse-core@9.1.1

## 9.1.0

### Minor Changes

- 5ccff8e: Add page detection to the task server. `POST /detect` reports a page's type, apart from a scan, from either a URL the server fetches once or a browser snapshot the client sends. The server keeps the payload in memory for 10 minutes, and `POST /tasks` with the returned `detectionId` scans that page without fetching the detected response again. `DELETE /detect/:id` drops a payload sooner. `POST /tasks` also accepts a plain `snapshot`. The new repeatable `serve --allow-origin <origin>` flag lets a browser extension call the server with CORS. Scan reports gain an optional `pageIdentity` field that records the detection a scan started from; a detected type stays `detected` and never changes scoring. Core adds `detectPage`, `PayloadOrigin`, and the `targetPage` and `pageIdentity` scan options.

  The fetcher now stops reading a response body once it holds enough for the 5 MB it keeps, instead of buffering the whole body first; the kept text is unchanged.

### Patch Changes

- Updated dependencies [f182e70]
- Updated dependencies [4b769cd]
- Updated dependencies [5ccff8e]
- Updated dependencies [e44348d]
  - @forkpoint/agent-lighthouse-core@9.1.0

## 9.0.0

### Minor Changes

- b6cb4ef: Add `agent-lighthouse serve` and the new `@forkpoint/agent-lighthouse-server`
  package: scans run as tasks, and their progress streams to a browser over
  Server-Sent Events, with a JSON polling route as a fallback. Core emits a new
  `phase:total` scan event when a phase's planned total changes.

### Patch Changes

- Updated dependencies [38a9890]
- Updated dependencies [9b3361a]
- Updated dependencies [b6cb4ef]
- Updated dependencies [b6cb4ef]
  - @forkpoint/agent-lighthouse-core@9.0.0
