# @forkpoint/agent-lighthouse-mcp

## 0.4.0

### Minor Changes

- 7fe831f: Add structured scan progress events:
  - Core: typed `ScanEvent` stream via `runScan(url, { onEvent })` — phase/unit events with computed monotonic `fraction` and `elapsedMs`, per-audit progress, and `unit:fail` visibility for errored audits
  - CLI: interactive progress renderer (spinner, progress bar, ETA, per-phase summary lines) and `--progress-json` NDJSON event stream on stderr
  - MCP: `notifications/progress` forwarded when the request carries a `progressToken`

  Breaking (pre-1.0): the legacy progress callback forms were removed, not just deprecated —
  - `runScan(url, onProgress, pageOverrides, signal)` → use `runScan(url, { onEvent, pages, signal })`
  - `runAudits(ctx, config, (completed, total) => …)` → use `runAudits(ctx, config, (event: AuditProgressEvent) => …)`; an optional precomputed `AuditPlan` from `planAudits` can be passed as a fourth argument
  - The `ProgressCallback` and `AuditProgressFn` types are no longer exported

### Patch Changes

- Updated dependencies [7fe831f]
  - @forkpoint/agent-lighthouse-core@0.4.0
  - @forkpoint/agent-lighthouse-report@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [5569df0]
  - @forkpoint/agent-lighthouse-core@0.3.0
  - @forkpoint/agent-lighthouse-report@0.3.0

## 0.2.4

### Patch Changes

- 23ad2b8: Relicense the project and published packages from GPL-3.0-only to Apache-2.0.
- Updated dependencies [23ad2b8]
  - @forkpoint/agent-lighthouse-core@0.2.4
  - @forkpoint/agent-lighthouse-report@0.2.4

## 0.2.3

### Patch Changes

- c845f40: Use package metadata for generated report and MCP version labels, and avoid stale static docs version badges.
- Updated dependencies [c845f40]
  - @forkpoint/agent-lighthouse-core@0.2.3
  - @forkpoint/agent-lighthouse-report@0.2.3

## 0.2.2

### Patch Changes

- 229c08b: Add launch, showcase, and badge assets, and refresh generated report and MCP version labels.
- Updated dependencies [229c08b]
  - @forkpoint/agent-lighthouse-core@0.2.2
  - @forkpoint/agent-lighthouse-report@0.2.2

## 0.2.1

### Patch Changes

- 939a2c6: Improve package discoverability with clearer descriptions, npm README pages, expanded keywords, promotion assets, and an accurate CLI version banner.
- Updated dependencies [939a2c6]
  - @forkpoint/agent-lighthouse-core@0.2.1
  - @forkpoint/agent-lighthouse-report@0.2.1

## 0.2.0

### Minor Changes

- 54ef55c: Initial release of Agent Lighthouse:
  - Core gatherer & audit engine with 10 audit categories for agentic readiness
  - Standalone zero-dependency HTML report generator with SVG score gauges
  - Zero-config terminal CLI (`@forkpoint/agent-lighthouse`)
  - Model Context Protocol (MCP) server

### Patch Changes

- Updated dependencies [54ef55c]
  - @forkpoint/agent-lighthouse-core@0.2.0
  - @forkpoint/agent-lighthouse-report@0.2.0
