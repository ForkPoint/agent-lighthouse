# @forkpoint/agent-lighthouse-integration-testing

## 0.2.1

### Patch Changes

- 572119e: Run one ACP sandbox probe per caller signal. A second caller with its own signal used to receive the first caller's result and could not abort it.

## 0.2.0

### Minor Changes

- 0196974: Add a private local ACP sandbox integration test CLI with pinned schema checks, isolated credential transport, bounded cleanup and JSON results. Public scan contracts remain unchanged.
