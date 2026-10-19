# Page detection service — design

Status: approved in brainstorming, 2026-10-19. Target release: 9.1.0 (`minor`).

## Goal

A browser extension calls the task server to learn a page's type, apart from
a scan. Detection runs server side, on either a URL the server fetches or a
page the extension captured. A later scan can reuse the exact payload that
detection saw.

## Principle

Detection and scan are two phases over one payload. Where the payload comes
from does not matter: a fetch by the server or a capture by a client. The
engine runs no browser. The extension already holds the rendered page.

## Non-goals

- No headless browser, no Playwright dependency.
- No `/detect` in the MCP server. The extension talks HTTP to `serve`.
- No hash comparison between phases and no mismatch warning. The scan trusts
  the identity it receives and records the facts.
- No change to how a type's source affects scoring.
- The extension itself is not in this repository. The repository ships the
  HTTP contract and its documentation.

## Core: `detectPage`

New public function in `packages/core`:

```ts
interface PagePayload {
  url: string;
  html: string;
  origin: PayloadOrigin; // PayloadOrigin.Fetched | PayloadOrigin.Supplied
  sha256: string; // computed by the server, never taken from the client
}

interface PageIdentity {
  url: string;
  type: PageType;
  confidence: PageClassification["confidence"];
  signals: string[];
  payloadSha256: string;
  origin: PayloadOrigin;
  partial: boolean;
  gatewayTarget?: string; // set when the page is a gateway; not followed
}

function detectPage(
  payload: PagePayload,
  opts?: { partial?: boolean },
): PageIdentity;
```

- Wraps `classifyPage` (`packages/core/src/parser.ts`), with the same parse
  and `DOM_WORK_LIMITS` as a scan. It fetches nothing and runs no audit.
- A partial payload sets `partial: true` and caps `confidence` at `"low"`.
- `PayloadOrigin` is a const object plus type, per the enum rule.

## Server: `POST /detect`

The body carries exactly one of `url` or `snapshot`:

```json
{ "url": "https://shop.example/p/123" }
```

```json
{
  "snapshot": { "requestedUrl": "…", "capturedUrl": "…", "html": "…", "…": "…" }
}
```

### URL input (`origin: fetched`)

- `isSafeUrl` first, then one fetch with the scanner's fetcher (same
  User-Agent and redirect handling, `isSafeUrl` on every hop).
- One request only: no robots, sitemap or other pages.
- A gateway page is reported with `gatewayTarget`. Detection does not follow
  it; the scan still follows gateways as today.
- Timeout 15 s.

### Snapshot input (`origin: supplied`)

- Validated by the existing `BrowserSnapshotSchema` and its byte and URL
  rules. No fetch.
- A truncated, redacted or `documentState: "loading"` snapshot is partial.
- Snapshot metadata stays the client's claim, as
  `docs/architecture/browser-snapshots.md` states.

### Response

`200`:

```json
{
  "detectionId": "d_7f3a…",
  "url": "…",
  "type": "product",
  "confidence": "high",
  "signals": ["schema.org Product", "offer price"],
  "payloadSha256": "ab12…",
  "origin": "fetched",
  "partial": false
}
```

`payloadSha256` is information only. Nothing compares it.

## Payload store

`/detect` keeps the payload so a scan can reuse it without a second fetch or
upload. That avoids rescanning HTML that changes on every request (tokens,
timestamps, ad ids).

- In memory, behind an interface, like `TaskStore`.
- TTL 10 minutes, at most 50 entries, at most 32 MiB in total. The oldest
  entry is evicted first; a full store never refuses a request.
- Expiry is checked on every read.
- `DELETE /detect/:id` removes an entry.
- The entry stays until its TTL ends, so a failed scan start can retry.

New constants in `packages/server/src/limits.ts`: `DETECTION_TTL_MS`,
`MAX_DETECTIONS`, `MAX_DETECTION_BYTES`, `MAX_RUNNING_DETECTS` (8),
`DETECT_FETCH_TIMEOUT_MS` (15 s), `MAX_PAYLOAD_BODY_BYTES` (about 2.2 MiB).

## Server: `POST /tasks` with `detectionId`

```json
{ "detectionId": "d_7f3a…" }
```

- `detectionId` must come alone. With `url` or `snapshot` it is `400`.
- The scan's target URL comes from the entry. The scan uses the stored payload
  for the target page and does not fetch it again. Other sampled pages are
  fetched and classified as today.
- A supplied payload also feeds `snapshots`, so the browser assessment runs
  on it as today.
- `POST /tasks` with a plain `snapshot` and no `detectionId` stays possible.

### Report field

The scan report gains:

```ts
pageIdentity?: {
  type: PageType;
  source: PageTypeSource;
  detectionId?: string;
  payloadSha256: string;
  origin: PayloadOrigin;
}
```

A type from detection stays `PageTypeSource.Detected`. Type-specific audits
on it remain advisory (`audit-runner.ts`). Only a type a person states
(`--page-type`) is `Declared`.

## Access

- The token guards every POST and DELETE, as today.
- New repeatable option `serve --allow-origin <origin>`, for example
  `chrome-extension://<id>`. Exact match only.
- An allowed origin passes the foreign-`Origin` check and gets CORS headers.
- `OPTIONS` preflight for an allowed origin: `204` with
  `Access-Control-Allow-Origin: <exact origin>`,
  `Access-Control-Allow-Headers: Authorization, Content-Type`,
  `Access-Control-Allow-Methods: GET, POST, DELETE`, and `Vary: Origin`.
  Any other origin gets `403`.
- The body limit is `MAX_PAYLOAD_BODY_BYTES` on `POST /detect` and
  `POST /tasks`. Every other route keeps `MAX_BODY_BYTES` (16 KiB).

## Errors

| Case                                         | Answer                                                      |
| :------------------------------------------- | :---------------------------------------------------------- |
| Missing or wrong token                       | `401`                                                       |
| Foreign `Origin` not in `--allow-origin`     | `403`                                                       |
| Non-JSON body                                | `415`                                                       |
| Body over the limit                          | `413`                                                       |
| Both `url` and `snapshot`, or neither        | `400`                                                       |
| Snapshot fails `BrowserSnapshotSchema`       | `400` with the first schema error                           |
| `isSafeUrl` refuses the URL                  | `400` "unsafe URL"                                          |
| Fetch error or timeout                       | `502` with the fetch error text                             |
| Response is not HTML (`content-type`)        | `422` "not an HTML page"                                    |
| Page answers HTTP 400 or above               | `422` "page returned HTTP <status>"                         |
| Page over `DOM_WORK_LIMITS`                  | `422` "page too deep to assess"                             |
| `MAX_RUNNING_DETECTS` reached                | `429` with `Retry-After: 1`                                 |
| Unknown or expired `detectionId` on `/tasks` | `404` "detection expired; detect again or send the payload" |
| `detectionId` with `url` or `snapshot`       | `400`                                                       |

## Tests

- `detectPage`: product, article, gateway, partial snapshot.
- Payload store: TTL, eviction by count, eviction by bytes, delete.
- `http.test.ts`: every row of the error table; preflight for an allowed and
  a refused origin; the larger body limit only on the two routes.
- End to end: snapshot to `/detect`, its id to `/tasks`; the report carries
  `pageIdentity` with the same `payloadSha256`, and the target URL is not
  fetched again.
- URL detection mocks the fetcher. No test performs real network or DNS.

## Docs and release

- `docs/server.md`: the `/detect` contract, `--allow-origin`, and retention
  (HTML kept in memory up to 10 minutes; a snapshot can hold private data).
- `docs/architecture/browser-snapshots.md`: link to the detection flow.
- One `minor` changeset: new route, new flag, new report field.
