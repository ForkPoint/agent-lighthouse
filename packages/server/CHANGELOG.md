# @forkpoint/agent-lighthouse-server

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
