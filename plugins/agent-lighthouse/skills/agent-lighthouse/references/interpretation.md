# Interpret current and saved reports

Use the report's recorded version and shape. Missing fields in an older report mean **not recorded**, not zero, pass, or current behavior. A synthetic excerpt cannot establish a full scan's validity or coverage. Preserve it as an excerpt.

## Score and page scope

- Keep `overallScore: null` and the recorded `scanValidity.unscoredReason`. Report missing evidence before proposing content fixes. Do not convert null to 0 or calculate a replacement score.
- A category with no assessed scored mass has no score. Its stored `score: 0` is not a failing grade. In an MCP summary, check `assessed`.
- Read every `categories[].checks[]` entry. Read its `coverage` and nested `advisoryResults` when present. One top-level audit can cover declared pages while its nested results describe detected pages. The nested results do not add scored audits.
- `coverage.selectedUrls` includes pages the audit selected, including failed reads. `inputUrls` names pages supplied to it. `unreadUrls` names missing reads. `unsentUrls`, when present, names requests the scanner held back after the site paused the scan. Do not equate selection with successful assessment.
- Read `pageAttempts` and `pagesScanned[].classification` when present. Declared purpose supports type-specific scoring; detected purpose supports advisory findings. Common checks can still score detected pages.
- Check `conditions.budget`, `conditions.requestStop`, evidence-gate reasons, and audit errors before calling `na` an intentional absence. A `requestStop` with `stopped: true` means the site answered 429, 403 or repeated 503 and later requests were never sent; its `affectedMass` is a lower bound. A budget skip or missing input proves no verdict. An `Audit error` calls for scanner diagnosis, not an invented site defect.

When the page purpose is wrong, recommend a corrected declaration and a new baseline. Do not add Article markup to a homepage to satisfy an old report. Do not compare a detected baseline with a declared rescan as proof of a site improvement.

## Notices and optional artifacts

The current tiers are `scored`, `informative`, `experimental`, and `obsolete`. Grade alone does not determine whether a result counts. Preserve `tier`, `weight`, `scoreDisplayMode`, coverage, and any `deprecated` notice.

An obsolete check warns when it finds a retired artifact. Adding that artifact cannot fix it. Read the notice's source and replacement before proposing removal or replacement. A notice with `kind: unconsumed` means no documented AI consumer, not that the artifact is necessarily broken. A generic `deprecated` notice can refer to the check itself. Do not treat all notices as removal orders.

Do not create `llms.txt`, OpenAPI, MCP, WebMCP, or commerce metadata solely to fill missing results. Separate absence, malformed content, and a linked artifact that returns an error. Judge readable surviving content when only part of an artifact is broken.

For Content Signals, use [content-signals.md](content-signals.md). Optional setup advice can accompany a verified `na` result without becoming a failed check. Missing, restrictive, or undeclared preferences do not justify a score penalty or an assumed policy change.

## Browser evidence

`browserAssessment` describes supplied rendered DOM. `overallScore` and `categories` describe HTTP crawler evidence. Present these as separate views. The browser score is always null. Read its `findings`, `coverage`, `missingEvidence`, `notEligible`, and `limits`; never fold them into the crawler score or count them as more crawler audits.

Prefer an existing assessment when it meets the task. If a new capture is needed, use the available browser tool and inspect the installed engine's snapshot schema. The engine includes no collector. Use the real capture time, URL, collector name/version, document state, redaction, and truncation metadata. Never relabel a partial or sanitized capture as complete evidence.

The current input has `snapshots: { version: 1, pages: [...] }`. Each page carries `requestedUrl`, `capturedUrl`, `html`, `capturedAt`, `captureSource`, `collector`, `documentState`, `truncation`, and `redaction`. See the [snapshot contract](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/architecture/browser-snapshots.md) or the installed schema for exact constraints. The URL must match the scan target or an explicit `pages` entry. A redirected capture needs the captured URL as its scan target.

A loading, redacted, or truncated capture yields missing evidence, not an absence verdict. Even a complete DOM does not prove HTTP headers, robots access, computed visibility, shadow/frame content, login independence, or action success. Record the capture context. A logged-in tab does not prove public access.

Raw DOM can contain private data. Obtain consent before uploading it to an external service. Do not disable redaction to obtain a verdict. Never submit a real form or purchase to prove a markup finding without authority for that action.

## Before/after evidence

Compare target, resolved engine version, categories, page declarations, page population, timeout, experimental setting, and capture conditions. Keep the exact invocation and relevant config with each run. Record source/deployed revision when available.

Match findings by audit ID, evidence source, page/population, and coverage. Report each changed verdict with its evidence. Separate site changes from scanner upgrades, new declarations, changed samples, and recovered reads. A larger score with less evidence does not prove improvement. Keep a local fix pending until the deployment and matching rescan support it.
