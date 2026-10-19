# Browser-rendered snapshot assessment

A caller can hand the scan HTML that a browser rendered. Seven reviewed audits then run on that DOM, and the report shows their findings apart from the crawler score. The engine includes no browser collector. The [task server](../server.md#page-detection) accepts captures over HTTP.

## Public contract

`runScan(url, { snapshots })` accepts `BrowserSnapshots`. The types come from the root API or the browser-safe `@forkpoint/agent-lighthouse-core/contracts` entry; the validation schemas from the browser-safe `@forkpoint/agent-lighthouse-core/schemas` entry. Neither entry pulls in the scanner or Node dependencies.

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

The shapes live in `packages/core/src/contracts.ts`. `BrowserSnapshotsSchema` and `SnapshotScanOptionsSchema` validate input; `BrowserAssessmentSchema` and `ScanReportSchema` validate output. `browserSnapshotsJsonSchema()` supplies the MCP tool schema. Runtime validation also checks byte sizes and URL associations, which JSON Schema cannot.

The CLI reads the same `snapshots` field from its [config file](../config.md#keys). The MCP `audit_website` tool accepts it and returns the browser assessment.

The task server takes a snapshot over HTTP. `POST /detect` reports a capture's page type without a scan, and `POST /tasks` with the returned `detectionId` scans it with the stored capture as its snapshot. See [page detection](../server.md#page-detection).

All metadata is the client's claim. The engine does not verify who captured a page, when, or with what cookies. No status code, header, cookie, redirect or timing comes from a snapshot.

## Input limits

Any violation throws before the first fetch.

| Rule                    | Limit                                                                                                   |
| :---------------------- | :------------------------------------------------------------------------------------------------------ |
| Snapshots               | 1 to 6, one per associated URL                                                                          |
| HTML size               | 2 MiB (2,097,152 UTF-8 bytes) per page; 6 MiB per batch                                                 |
| URLs                    | Absolute HTTP(S), no credentials, at most 2,048 characters                                              |
| `requestedUrl`          | The scan target or an explicit `pages[].url`. A gateway target does not qualify.                        |
| `capturedUrl`           | Equal to `requestedUrl` apart from the fragment. A redirected capture needs a scan of its captured URL. |
| Collector name, version | 1–100 nonblank characters each                                                                          |
| `capturedAt`            | A valid date and time with a timezone. No freshness window applies.                                     |
| Redaction fields        | At most 100 strings of 1–100 characters; empty when not redacted                                        |
| `originalBytes`         | A nonnegative integer, at least the supplied HTML size                                                  |
| Other                   | Unknown keys, unsupported versions, duplicate associations and bad schemes are refused                  |

URLs associate without fragment, credentials or trailing path slash; the query must match exactly.

A truncated, redacted or still-loading capture stays in the report but yields no findings: each eligible audit records missing evidence, because a partial DOM cannot prove absence. An `interactive` or `complete` capture can run static checks; neither proves late scripts finished.

Raw HTML can hold private data. Collectors must disclose the upload and obtain consent. The engine does no redaction and keeps no raw HTML in the report. The task server keeps a detected capture's HTML in memory for up to 10 minutes; see [retention](../server.md#retention).

## How a snapshot runs

The crawler path is unchanged: fetch, parse, `buildScanEvidence`, `planAudits`, `runAudits`, scoring. After it, `assessBrowserSnapshots` runs each snapshot through the same `parsePageContext` and `runAudits`, with evidence from `buildSnapshotEvidence`.

- Each snapshot is independent: its own DOM, empty root-file context, cache owner and evidence. No HTTP cache is shared.
- A snapshot context cannot fetch. Reading `PageContext.fetchResult` or calling fetch throws, so an accidental HTTP read fails closed.
- Snapshot evidence keeps `origin-reachable` and `unblocked-fetches` false. Its readability gate drops content the static visibility helper treats as hidden.
- An audit runs only if its id is in `SNAPSHOT_AUDITS` (`packages/core/src/snapshot-eligibility.ts`), even with `enforceEvidenceGate: false`. Every eligible audit needs readable snapshot text, so a consent wall or empty shell proves nothing.
- Ineligible audits are listed once per assessment under `notEligible`.
- A failure in one capture becomes missing evidence for that capture only. Other captures and the crawler report stand.
- Caller cancellation also ends snapshot work. A blocked crawl or exhausted budget neither adds nor removes DOM evidence.

HTTP pages and captures share `DOM_WORK_LIMITS`, checked before extraction and classification:

- Depth: parsing stops at the first element deeper than 512.
- Summed element depth: 3,000,000 for a served page, 1,000,000 per capture.
- A page over a limit is reported as not assessed, without a verdict. An HTTP page keeps its real status; a capture gets missing-evidence records.

## Supported audit inventory

Each row names an existing audit; its dossier is `docs/evidence/audits/<id>.md`.

| Audit ID                                             | DOM evidence                                                                                   | Gate and limits                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-extraction/image-alt-text`                  | Image names from alt, ARIA labels/references, and title                                        | Complete unredacted DOM. Existing decorative and direct ARIA-hidden exclusions apply. Ancestor hiding and computed accessibility-tree coverage remain limited.                   |
| `content-extraction/section-headings`                | Section content, heading descendants, and label attributes                                     | Complete unredacted DOM. Existing audit semantics apply, including descendant-heading and truthy-label rules. It does not resolve every section label or prove visual structure. |
| `content-extraction/semantic-lists`                  | List, definition, and numbered-prose structure                                                 | Readable static DOM. Existing hidden-content and navigation exclusions apply. ARIA-equivalent markup and computed CSS remain limited.                                            |
| `structured-data/json-ld-present`                    | Parsed JSON-LD blocks in the captured DOM                                                      | Complete unredacted DOM. Presence does not prove delivery to GPTBot, Merchant Center, or any other crawler. Parse failures retain the existing audit behavior.                   |
| `structured-data/schema-validation`                  | Existing context/type checks on parsed JSON-LD, Microdata, and RDFa                            | Complete unredacted DOM. This is the existing heuristic, not complete JSON-LD validation. Nested-node and absence limitations remain.                                            |
| `operability-safety/form-autofill-token-coverage`    | Serialized labels, field identities, types, autocomplete tokens, constraints, and error wiring | Complete unredacted DOM. No input filling, current value, constraint execution, event handling, or submission proof.                                                             |
| `operability-safety/profile-autofill-token-coverage` | Serialized labels, field identities, types, autocomplete tokens, constraints, and error wiring | Complete unredacted DOM. No input filling, current value, constraint execution, event handling, or submission proof.                                                             |

Grades, tiers and crawler weights are unchanged. Every browser finding is informative, with weight 0. `content-extraction/server-rendered` always uses the real HTTP response; headers, status, redirects, robots policy and actions never come from a snapshot. Other audits are reported as lacking a reviewed snapshot contract, which is not a claim they can never support one. Adding an audit takes a source and dossier review, an inventory entry, and tests for its evidence limits.

## Output and scoring

A scan with snapshots adds `browserAssessment` to the report. Every other field keeps its crawler meaning.

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

- There is no browser score. Seven static checks cannot measure agent task success.
- Unsupported audits stay out of the coverage denominator. Truncated, redacted and loading captures count as eligible but unassessed, as do unreadable pages, page-purpose gates and audit errors.
- JSON, `ScanReportSchema`, `hydrateReport` and `buildReportView` keep the assessment. HTML, Markdown and terminal reports show it in its own section.
- Report text from a snapshot is escaped (HTML, Markdown) or stripped of control characters (terminal). Snapshot scripts and handlers never run.
- A URL-only scan adds no browser fields, and saved reports without one still validate.

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

## Limits of serialized HTML

Serialized HTML cannot show computed appearance, a full accessibility tree, event handlers, frames, shadow roots, live form state, login independence or whether controls work. Absence from the HTML does not prove absence from a frame or shadow tree. A `fresh-browser` label does not authenticate capture conditions.

## Deferred

Not built: snapshot contracts for the other audits, browser automation, computed styles, accessibility-tree input, shadow-root and frame capture, action traces, authenticated collector provenance, a freshness policy, a browser score, an extension collector, and durable snapshot storage. The task server keeps a detected capture in memory for 10 minutes only.
