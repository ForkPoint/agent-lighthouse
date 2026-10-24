# @forkpoint/agent-lighthouse-server

## 10.3.0

### Patch Changes

- Updated dependencies [33f7e6e]
- Updated dependencies [33f7e6e]
  - @forkpoint/agent-lighthouse-core@10.3.0

## 10.2.0

### Patch Changes

- Updated dependencies [4144a23]
- Updated dependencies [3fbf918]
  - @forkpoint/agent-lighthouse-core@10.2.0

## 10.1.0

### Patch Changes

- Updated dependencies [45a1d88]
- Updated dependencies [cb638ba]
- Updated dependencies [4648663]
- Updated dependencies [fbc7535]
- Updated dependencies [6a5d1ab]
- Updated dependencies [1dbf1e7]
  - @forkpoint/agent-lighthouse-core@10.1.0

## 10.0.0

### Patch Changes

- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
- Updated dependencies [80adba8]
  - @forkpoint/agent-lighthouse-core@10.0.0

## 9.2.1

### Patch Changes

- bd056c3: Runtime dependency updates: `parse5-htmlparser2-tree-adapter` 8.0.1, `undici` 8.12.2, `zod` 4.6.7, `jsdom` 30.1.3 and `gpt-tokenizer` 4.0.3. The packages are now built with `tsup` 9 and `esbuild` 0.28.2. No audit verdict changes: the CommonJS and ESM bundles still agree on all 221 audits.
- Updated dependencies [bd056c3]
  - @forkpoint/agent-lighthouse-core@9.2.1

## 9.2.0

### Patch Changes

- Updated dependencies [7c55327]
  - @forkpoint/agent-lighthouse-core@9.2.0

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
