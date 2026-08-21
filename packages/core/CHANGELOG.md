# @forkpoint/agent-lighthouse-core

## 1.0.0

### Major Changes

- 5c84ed9: **Removed 18 audits with no proven consumer ("not a factor").** They no longer
  run, no longer appear in any report, and no longer emit a `CheckResult` under
  their old id. An adversarial evidence review — one researcher per audit, tasked
  with _redeeming_ it by naming a consumer with grade A/B evidence — could not
  find one for any of these: either nothing reads the signal, or the only thing
  that ever did publicly stopped (OpenAI archived the ai-plugin.json spec; Google
  states it no longer uses rel=prev/next). Shipping them as informative would
  have kept noise on the report with a badge attached, so they are deleted.

  Removed audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17, 5.25,
  6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

  **Expect scores to move for the same site.** Every category score, the overall
  score, and `readinessVitals` / the derived `readinessScore` can come out
  different — the removed checks are gone from the denominators. Audit 8.21
  (framework-detection) in particular used to feed a near-constant pass into the
  technical vital, propping it up regardless of the site; that unearned signal is
  gone, so the new number can be lower and is the honest one.

  **Consumers keying on these check ids must migrate via `migration-map.json`,**
  shipped in the core package and keyed by v1 audit id. Each entry carries
  `slug`, `status: "removed"`, `reason: "not-a-factor"`, and a `link` to that
  audit's rationale anchor. Look every missing id up there before treating its
  absence as a scan failure; a `"removed"` id has no replacement to re-point a
  dashboard at. See `MIGRATION.md`.

  Full rationale — steelmanned claim, why it is not a factor, verdict and sources
  per audit, plus the complete research dossiers — lives in
  `docs/evidence/sunset/NOT-A-FACTOR.md`.

  Also in this release: the exported `calculateCategoryScore` now excludes
  informative checks from its mean, so its return value changes for any input
  containing them (previously they counted like any other check). Callers
  constructing `CheckResult` objects directly should expect a different result
  for the same array. The deprecation machinery — `AuditMeta.deprecated` /
  `CheckResult.deprecated` (`DeprecationNotice { notice, link }`), the
  `isInformative` predicate, and the report's deprecation-notice rendering — is
  kept for future deprecations and the planned informative tier.

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

## 0.3.0

### Minor Changes

- 5569df0: Add 8 new AI-readiness audits:
  - SVG context bloat — detects inline SVGs bloating agent context (6.18)
  - Token-to-content ratio — flags pages where markup tokens dwarf actual content (6.19)
  - Fake headings — detects heading-styled elements that skip semantic `<h1>`–`<h6>` tags (6.20)
  - Form backend actionability — checks forms expose actionable backends agents can submit to (5.27)
  - Product transactional certainty — verifies Product schema carries machine-readable offer/price/availability signals (3.24)
  - TDM-Rep data-mining rights — detects declared text-and-data-mining usage rights (2.27)
  - AI crawler vs conversational agent separation — checks robots.txt distinguishes training crawlers from user-driven agents (2.28)
  - OpenAPI description quality — scores endpoint descriptions for LLM tool-calling usability (5.26)

## 0.2.4

### Patch Changes

- 23ad2b8: Relicense the project and published packages from GPL-3.0-only to Apache-2.0.

## 0.2.3

### Patch Changes

- c845f40: Use package metadata for generated report and MCP version labels, and avoid stale static docs version badges.

## 0.2.2

### Patch Changes

- 229c08b: Add launch, showcase, and badge assets, and refresh generated report and MCP version labels.

## 0.2.1

### Patch Changes

- 939a2c6: Improve package discoverability with clearer descriptions, npm README pages, expanded keywords, promotion assets, and an accurate CLI version banner.

## 0.2.0

### Minor Changes

- 54ef55c: Initial release of Agent Lighthouse:
  - Core gatherer & audit engine with 10 audit categories for agentic readiness
  - Standalone zero-dependency HTML report generator with SVG score gauges
  - Zero-config terminal CLI (`@forkpoint/agent-lighthouse`)
  - Model Context Protocol (MCP) server
