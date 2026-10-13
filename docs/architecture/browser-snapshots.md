# Browser-rendered snapshot assessment

This document describes the implemented snapshot path. It does not describe a browser collector or an extension upload endpoint.

## Public contract

`runScan(url, { snapshots })` accepts `BrowserSnapshots` from the root API or the browser-safe `@forkpoint/agent-lighthouse-core/contracts` entry. Validation schemas live in the browser-safe `@forkpoint/agent-lighthouse-core/schemas` entry. Both entries exclude the scanner and Node dependencies.

```ts
interface BrowserSnapshots {
  version: 1;
  pages: BrowserSnapshot[];
}
interface BrowserSnapshot {
  requestedUrl: string;
  capturedUrl: string;
  html: string;
  capturedAt: string; // ISO 8601, with Z or a UTC offset
  captureSource: "current-tab" | "fresh-browser";
  collector: { name: string; version: string };
  documentState: "loading" | "interactive" | "complete";
  truncation: { truncated: boolean; originalBytes?: number };
  redaction: { redacted: boolean; fields: string[] };
}
```

The source defines these shapes in `packages/core/src/contracts.ts`. `BrowserSnapshotSchema`, `BrowserSnapshotsSchema`, `SnapshotCaptureSchema`, `SnapshotScanOptionsSchema`, `BrowserAssessmentSchema`, and `ScanReportSchema` validate the input and saved output. `browserSnapshotsJsonSchema()` supplies the MCP schema on first use. JSON Schema describes the shape; runtime validation also checks byte size and URL associations.

All metadata comes from the client. The engine does not verify who captured a page, when it was captured, or whether a fresh browser had an empty cookie jar. No status code, response header, cookie, redirect chain, or network timing comes from the snapshot.

## Input limits

- One to six snapshots. One snapshot per associated URL.
- Maximum HTML size: 2,097,152 UTF-8 bytes per page.
- Maximum HTML batch size: 6,291,456 UTF-8 bytes.
- Maximum URL length: 2,048 characters. Only absolute HTTP(S) URLs without credentials qualify.
- `requestedUrl` must match the scan target or an explicit `options.pages[].url` declaration. Auto-discovered pages do not authorize extra snapshot associations.
- `capturedUrl` must match `requestedUrl` after URL normalization and fragment removal. Path, query, scheme, and origin must match. A redirected capture needs a new scan of its captured URL. Snapshot metadata never proves a redirect.
- Collector name and version: 1–100 nonblank characters each.
- Capture time: a valid ISO date and time with a timezone. The engine sets no freshness window. The report exposes the claimed capture time.
- Redaction fields: at most 100 strings, each 1–100 characters. An unredacted capture must have an empty list.
- `originalBytes`, when present, must be a nonnegative integer at least as large as the supplied HTML bytes. It describes the serialization size before truncation.
- Unknown input metadata keys, unsupported versions, malformed metadata, invalid schemes, credentials, duplicate associations, and size violations throw before any fetch starts.

A valid truncated, redacted, or still-loading capture remains in the report. It contributes no browser findings. Each eligible audit receives a missing-evidence reason. Partial or removed DOM cannot prove absence. An interactive or complete capture can run static checks; neither state proves that late scripts or network work finished.

Raw HTML can contain private data. Collectors must disclose and obtain consent for the upload. The engine does not perform redaction. It does not retain raw HTML in the report. A redacted capture deliberately produces coverage reasons rather than unsupported absence findings.

## Execution and evidence separation

The existing path remains `runScan` → HTTP fetches → page parsing → `buildScanEvidence` → `planAudits` → `runAudits` → crawler scoring and report assembly.

The optional path follows crawler assembly: `assessBrowserSnapshots` → the same `parsePageContext` → `buildSnapshotEvidence` → the same `runAudits`. The parser reuses JSON-LD, Microdata, RDFa, metadata, head-link extraction, and page classification. Existing audits retain their implementation and DOM helpers. The runner still selects pages and applies evidence gates. No dispatcher returns uploaded HTML as an HTTP response.

Each snapshot runs independently. Each has a separate DOM, empty root-file context, its own cache owner, and its own evidence object. There is no HTTP origin cache reuse. Explicit page declarations apply only to the matching URL. DOM classification uses the snapshot itself.

`DomPageContext` contains shared parsed fields. The legacy audit API still names `PageContext.fetchResult`; snapshot adapters guard that property with an error. An accidental HTTP read fails closed. The snapshot fetch function also throws. It cannot fetch uploaded resource URLs. HTTP fetches retain all existing URL, DNS, and redirect safety checks.

Snapshot evidence keeps `origin-reachable` and `unblocked-fetches` false. Its readability gate removes content hidden by the existing static visibility helper. This extra snapshot gate does not change HTTP readability or the existing server-rendered audit.

The runner admits a snapshot audit only when its exact ID occurs in `SNAPSHOT_AUDITS`. That record supplies reviewed DOM requirements instead of HTTP attribution requirements. Unknown audits remain gated even with `enforceEvidenceGate: false`. Every eligible audit requires readable snapshot text, as its crawler path does. A consent wall, error page, or empty shell captured as complete cannot prove absence. No category implies eligibility. The report lists ineligible audits once per assessment, under `notEligible`, not once per capture. A failure in one capture becomes missing evidence for that capture only. Other captures keep their findings, and the crawler report stays. A capture whose DOM nests deeper than 512 elements, or whose summed element depth exceeds 1,000,000, gets missing evidence and no audit runs on it. Chromium's HTML parser stops nesting at 512. DOM audits climb ancestors for each element, so deeper input would stall the scan. Snapshot URLs associate with the target and page declarations without fragments, credentials, or a trailing path slash. The query stays exact. A requested and a captured URL may differ only by fragment.

Browser parsing is bounded by the input limits. Browser work has no network requests. The existing crawler budget, duration, coverage, validity, score, suppression reason, category results, rankings, recommendations, and page attempts retain their server meaning. Caller cancellation also ends snapshot assessment. A blocked HTTP scan or an exhausted crawler budget does not supply or remove DOM evidence.

## Supported audit inventory

Each row names the existing audit and its dossier under `docs/evidence/audits/<id>.md`. The inventory lives in `packages/core/src/snapshot-eligibility.ts`.

| Audit ID                                          | DOM evidence                                                                                   | Gate and limits                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-extraction/image-alt-text`               | Image names from alt, ARIA labels/references, and title                                        | Complete unredacted DOM. Existing decorative and direct ARIA-hidden exclusions apply. Ancestor hiding and computed accessibility-tree coverage remain limited.                   |
| `content-extraction/section-headings`             | Section content, heading descendants, and label attributes                                     | Complete unredacted DOM. Existing audit semantics apply, including descendant-heading and truthy-label rules. It does not resolve every section label or prove visual structure. |
| `content-extraction/semantic-lists`               | List, definition, and numbered-prose structure                                                 | Readable static DOM. Existing hidden-content and navigation exclusions apply. ARIA-equivalent markup and computed CSS remain limited.                                            |
| `structured-data/json-ld-present`                 | Parsed JSON-LD blocks in the captured DOM                                                      | Complete unredacted DOM. Presence does not prove delivery to GPTBot, Merchant Center, or any other crawler. Parse failures retain the existing audit behavior.                   |
| `structured-data/schema-validation`               | Existing context/type checks on parsed JSON-LD, Microdata, and RDFa                            | Complete unredacted DOM. This is the existing heuristic, not complete JSON-LD validation. Nested-node and absence limitations remain.                                            |
| `operability-safety/form-autofill-token-coverage` | Serialized labels, field identities, types, autocomplete tokens, constraints, and error wiring | Complete unredacted DOM. No input filling, current value, constraint execution, event handling, or submission proof.                                                             |

The dossiers already document DOM, markup, extraction, or browser-consumer mechanisms for these observations. They do not establish a browser readiness score. Original grades, tiers, and crawler weights stay unchanged. Each browser finding uses informative display and weight 0.

`content-extraction/server-rendered` always uses the actual HTTP response. Headers, status, redirects, robots policy, network checks, and action execution stay outside snapshot evidence. The output names every other selected audit as missing its reviewed snapshot contract. This includes other DOM-based audits whose snapshot eligibility has not yet been reviewed. It is not a claim that those audits can never support snapshots.

Adding support requires an individual source/dossier review, an explicit inventory entry, and regression proof for its evidence limits. No second audit engine exists.

## Output and scoring

All existing `ScanReport` fields retain their meaning. Only a supplied snapshot adds `browserAssessment`:

```ts
interface BrowserAssessment {
  version: 1;
  evidenceSource: "browser-snapshot";
  score: null;
  unscoredReason: string;
  captures: SnapshotCapture[]; // input metadata without html
  findings: Array<{
    evidenceSource: "browser-snapshot";
    pageUrl: string;
    captureSource: "current-tab" | "fresh-browser";
    check: CheckResult; // original verdict; informative, weight 0
  }>;
  coverage: {
    eligibleAuditIds: string[]; // selected IDs after category/tier filters
    eligible: number; // eligible audits × supplied captures
    assessed: number; // completed audit/page pairs, including legitimate NA
  };
  missingEvidence: Array<{ auditId: string; pageUrl: string; reason: string }>;
  limits: string[];
}
```

Each finding names its source, page URL, and capture source. Each missing-evidence record names the audit and page. Unsupported audits do not enter the browser coverage denominator. Truncated/redacted/loading captures remain eligible pairs but unassessed. Missing readability, page-purpose gates, and audit errors also remain unassessed.

No calibrated browser score exists. Static checks cover only six reviewed rules. They cannot measure browser-agent task success or access independent of a logged-in tab. The output therefore has a null browser score and an explicit explanation. Audit-local numeric verdicts remain evidence from the original rule, not browser readiness scores.

JSON serialization, `ScanReportSchema`, `hydrateReport`, and `buildReportView` preserve the browser assessment. HTML, Markdown, and terminal reports display it separately. Current-tab and fresh-browser labels identify client claims. HTML/Markdown escape all browser report text. Terminal output strips client control characters. Snapshot scripts and event handlers never execute. Uploaded HTML never becomes a report template.

## Server-side usage

```ts
import { runScan } from "@forkpoint/agent-lighthouse-core";
import {
  CaptureSource,
  DocumentState,
} from "@forkpoint/agent-lighthouse-core/contracts";
import { BrowserSnapshotsSchema } from "@forkpoint/agent-lighthouse-core/schemas";

const url = "https://example.com/";
// Request-body parsing and transport limits belong to the host application.
const snapshots = BrowserSnapshotsSchema.parse({
  version: 1,
  pages: [
    {
      requestedUrl: url,
      capturedUrl: url,
      html: renderedHtml,
      capturedAt: capturedAtIso,
      captureSource: CaptureSource.CurrentTab,
      collector: { name: "chrome-extension", version: "1.0.0" },
      documentState: DocumentState.Complete,
      truncation: { truncated: false },
      redaction: { redacted: false, fields: [] },
    },
  ],
});
const report = await runScan(url, { snapshots });
// report.overallScore and report.categories describe HTTP crawler evidence.
// report.browserAssessment describes supplied static DOM evidence only.
```

CLI JSON config accepts the same `snapshots` field: `agent-lighthouse audit https://example.com/ --config scan.json`. MCP `audit_website` accepts the same field and returns the browser assessment in its summary. Neither adapter implements a collector.

## Fidelity and compatibility

HTML serialization cannot establish computed appearance, a complete accessibility tree, event handlers, frame content, shadow roots, live form state, login independence, working controls, or action success. Inline visibility markers are static evidence only. A fresh-browser label does not authenticate capture conditions. Absence from serialized HTML does not prove absence from another frame or shadow tree.

URL-only calls add no browser fields. Existing audit IDs, grades, tiers, weights, and crawler findings remain unchanged. Saved reports without a browser assessment still validate and hydrate. The new contracts and schema entry grow the public surface. The changeset uses a major bump under this repository's result-schema release rule.

## Regression proof

Deterministic fixtures cover HTTP shells, blocked HTTP access, browser-only JSON-LD, independent page contexts/cache owners, multiple supplied URLs, HTTP-only gates, input rejection before fetching, UTF-8 and aggregate limits, truncated/redacted/loading captures, hidden prose, serialized form attributes, non-executed scripts and handlers, unsafe snapshot resource/action URLs, source labels, schema round trips, browser-safe bundles, hydration, all affected renderers, CLI/MCP forwarding, and URL-only compatibility. Live sites are not regression fixtures.

## Deferred

The other registered audits have no reviewed snapshot contract. Full browser automation, computed styles, accessibility-tree input, shadow-root/frame capture, action traces, authenticated collector provenance, capture freshness policy, browser scoring, extension collection, and upload/storage endpoints belong to separate work.
