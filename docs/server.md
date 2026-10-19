# Task server

`agent-lighthouse serve` runs scans as tasks and streams their progress to a
browser over Server-Sent Events.

    npx @forkpoint/agent-lighthouse serve --port 8787

Open `http://127.0.0.1:8787/` for the built-in page, or use the routes below.

## Flags

| Flag             | Meaning                                                                                                                                              |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--port`         | Port to listen on. Default `8787`.                                                                                                                   |
| `--host`         | Address to bind. Default `127.0.0.1`.                                                                                                                |
| `--token`        | Bearer token for starting and cancelling scans. Defaults to `AL_SERVER_TOKEN`. See [Access](#access).                                                |
| `--allow-origin` | A browser origin, such as `chrome-extension://<id>`, that may call the server. Exact match. Repeat the flag for more origins. See [Access](#access). |

Flags accept both `--flag value` and `--flag=value`. A flag given without a
value fails with `Missing value for <flag>`. A value that starts with `-`
must use the `=` form, for example `--token=-abc`.

## Routes

| Method and path                  | Answer                                                                                                                                                                              |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /tasks`                    | Body `{"url": "https://…"}`, `{"snapshot": {…}}` or `{"detectionId": "d_…"}`. Returns `202 {"taskId", "snapshot"}`. Errors: `400`, `401`, `403`, `404`, `413`, `415`, `422`, `429`. |
| `POST /detect`                   | Body `{"url": "https://…"}` or `{"snapshot": {…}}`. Returns `200` with the page's type. See [Page detection](#page-detection).                                                      |
| `DELETE /detect/:id`             | Drops a stored detection. Returns `204`. Errors: `401`, `403`, `404`.                                                                                                               |
| `GET /tasks/:id`                 | The current snapshot. `404` for an unknown id.                                                                                                                                      |
| `GET /tasks/:id/stream`          | SSE. A `snapshot` frame, then one `progress` frame per event. `404` for an unknown id, `429` when too many streams are open.                                                        |
| `GET /tasks/:id/updates?after=N` | Events after cursor `N`, plus the snapshot. For clients that cannot stream. An `after` that is not an integer, or outside the kept events, returns `reset: true`.                   |
| `GET /tasks/:id/result`          | The scan report as JSON, once the task succeeded. `409 {"error": "not_ready", "status"}` before that.                                                                               |
| `DELETE /tasks/:id`              | Cancels the task. Returns `202 {"snapshot"}`. Errors: `401`, `403`, `404`.                                                                                                          |

Error statuses:

| Status | Body `error`             | Cause                                                                                                                                       |
| :----- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | `invalid_request`        | The body is not a JSON object, its fields do not form one of the accepted shapes, the URL does not parse, or the request target is invalid. |
| `400`  | `invalid_snapshot`       | The snapshot fails `BrowserSnapshotSchema`. `message` names the first error.                                                                |
| `401`  | `unauthorized`           | A token is set and the request does not carry it.                                                                                           |
| `403`  | `forbidden_origin`       | A POST or DELETE whose `Origin` host differs from its `Host`.                                                                               |
| `404`  | `not_found`              | No such route, task or detection.                                                                                                           |
| `404`  | `detection_expired`      | A `POST /tasks` whose `detectionId` is unknown or expired.                                                                                  |
| `405`  | `method_not_allowed`     | A method the task route does not serve.                                                                                                     |
| `409`  | `not_ready`              | The result of a task that has not succeeded.                                                                                                |
| `413`  | `payload_too_large`      | The body is over the route's limit. See [Limits](#limits).                                                                                  |
| `415`  | `unsupported_media_type` | A `POST /tasks` or `POST /detect` whose `content-type` is not `application/json`.                                                           |
| `421`  | `misdirected_request`    | A loopback-bound server got a `Host` that is not a loopback name.                                                                           |
| `422`  | `unsafe_target`          | The target resolves to a private or loopback address.                                                                                       |
| `429`  | `too_many_tasks`         | Four scans already run, or the task store is full.                                                                                          |
| `429`  | `too_many_streams`       | Too many SSE streams are open.                                                                                                              |

Every error body carries `error`. Some also carry a `message` for a person.
`POST /detect` adds its own errors; see [Errors](#errors).

## Page detection

`POST /detect` reports a page's type without a scan. A browser extension
calls it to learn what page the user is on. The body carries exactly one of
`url` or `snapshot`.

    {"url": "https://shop.example/p/123"}

The server checks the URL with `isSafeUrl`, then sends one request with the
scanner's fetcher: its User-Agent and redirect handling, with every hop
checked again. It reads no `robots.txt`, sitemap or other page. The fetch
times out after 15 seconds.

    {"snapshot": {"requestedUrl": "…", "capturedUrl": "…", "html": "…", …}}

A snapshot is a page the client captured. It is validated by
`BrowserSnapshotSchema`, with the byte and URL rules of
[browser snapshots](architecture/browser-snapshots.md). Nothing is fetched.
A truncated, redacted or `documentState: "loading"` capture is partial. Its
metadata stays the client's claim.

Detection parses the page with the scan's parser, classifier and DOM work
limits, and runs no audit. The answer:

    {
      "detectionId": "d_7f3a…",
      "url": "https://shop.example/p/123",
      "type": "product",
      "confidence": "strong",
      "signals": ["product-open-graph"],
      "payloadSha256": "ab12…",
      "origin": "fetched",
      "partial": false
    }

- `origin` is `fetched` for a URL and `supplied` for a snapshot.
- `confidence` is `strong`, `hint` or `unknown`. A partial payload never
  reports `strong`.
- `gatewayTarget` is present when the page is a gateway, such as a language
  splash. Detection does not follow it. A scan still does.
- `payloadSha256` is the SHA-256 of the HTML, computed by the server. It is
  information only. Nothing compares it.

### Scanning a detected page

`POST /tasks` with `{"detectionId": "d_…"}` scans the detected page. The
`detectionId` must come alone; with `url` or `snapshot` it gets `400`. The
scan targets the detected URL and reuses the stored payload:

- A fetched payload is the target's response. The scan does not request the
  target page again. Audits that probe the target on purpose, such as the
  User-Agent parity checks, still send their own requests, and every other
  page is fetched and classified as usual.
- A supplied payload runs as the scan's browser snapshot, as a plain
  `snapshot` would. The crawler still reads the target over HTTP, because no
  status code, header or redirect may come from a snapshot.

The report gains `pageIdentity`:

    "pageIdentity": {
      "type": "product",
      "source": "detected",
      "detectionId": "d_7f3a…",
      "payloadSha256": "ab12…",
      "origin": "fetched"
    }

A type from detection stays `detected`. Type-specific audits on it remain
advisory, as for any detected type. Only a type a person states, with
`--page-type`, is `declared`.

`POST /tasks` with a plain `{"snapshot": {…}}` and no `detectionId` scans
the snapshot's `requestedUrl` with that snapshot. A `url` sent beside it
must name the same page.

### Retention

The server keeps each detected payload in memory, HTML included, for up to
10 minutes, so a scan can reuse it. At most 50 payloads and 32 MiB are kept;
the oldest goes first. A scan that starts from a detection does not remove
it, so a failed start can retry. `DELETE /detect/:id` removes it sooner. A
restart loses every payload.

A snapshot can hold private data: what the user saw, signed in, on their own
device. A client that sends one must say so to its user and get consent.

### Errors

| Case                                         | Status | Body `error`, `message`                                                    |
| :------------------------------------------- | :----- | :------------------------------------------------------------------------- |
| Missing or wrong token                       | `401`  | `unauthorized`                                                             |
| Foreign `Origin` not in `--allow-origin`     | `403`  | `forbidden_origin`                                                         |
| Body not declared as JSON                    | `415`  | `unsupported_media_type`                                                   |
| Body over the limit                          | `413`  | `payload_too_large`                                                        |
| Both `url` and `snapshot`, or neither        | `400`  | `invalid_request`                                                          |
| Snapshot fails `BrowserSnapshotSchema`       | `400`  | `invalid_snapshot`, the first schema error                                 |
| `isSafeUrl` refuses the URL                  | `400`  | `unsafe_url`, "unsafe URL"                                                 |
| Fetch error or timeout                       | `502`  | `fetch_failed`, the fetch error text                                       |
| Response is not HTML (`content-type`)        | `422`  | `not_html`, "not an HTML page"                                             |
| Page answers HTTP 400 or above               | `422`  | `page_status`, "page returned HTTP <status>"                               |
| Page over the DOM work limits                | `422`  | `page_too_deep`, "page too deep to assess"                                 |
| Eight detections already run                 | `429`  | `too_many_detections`, with `Retry-After: 1`                               |
| Unknown or expired `detectionId` on `/tasks` | `404`  | `detection_expired`, "detection expired; detect again or send the payload" |
| `detectionId` with `url` or `snapshot`       | `400`  | `invalid_request`                                                          |

## Frames

Every `progress` frame carries the event and the snapshot it produced:

    id: 42
    event: progress
    data: {"event":{"type":"work.settled",…,"cursor":42},"snapshot":{…,"cursor":42}}

A client renders the snapshot. A client that reconnects receives the
current snapshot as its first frame and needs no replay. A frame whose
snapshot cursor is lower than one already shown is stale; skip it.

`completed` counts work that ran, including an audit whose verdict is a
fail. `error` counts work that could not run. `skipped` counts audits that
were not assessed. Every audit's `work.settled` event carries a
`reasonCode`: `ran`, `error`, or why it was skipped (`skipped`, `gated`,
`budget`).

## Limits

Tasks live in memory. A restart loses them. Four scans run at once; more
answer `429`. A finished task stays readable for 60 minutes. Eight
detections run at once; more answer `429` with `Retry-After: 1`.

`POST /detect` and `POST /tasks` accept bodies up to about 2.2 MiB, room for
one 2 MiB snapshot. Every other route accepts 16 KiB. A larger body gets
`413`.

## Access

The server binds `127.0.0.1` by default. With `--host` set to another
address, set a token: starting and cancelling a scan then need
`Authorization: Bearer <token>`. Prefer the `AL_SERVER_TOKEN` environment
variable over `--token`. A token on the command line is visible to other
users in `ps`. Reads go by task id, a random UUID. Target URLs that resolve
to private or loopback addresses are refused.

Three checks keep other web pages out of a local server:

- `POST /tasks` and `POST /detect` need `content-type: application/json`. A
  page on another site cannot send that type without a CORS preflight, and
  the server answers a preflight only for an origin given with
  `--allow-origin`. Other types get `415`.
- A POST or DELETE with an `Origin` header whose host differs from the
  `Host` header gets `403`, unless the origin was given with
  `--allow-origin`. Clients that send no `Origin`, such as `curl`, pass.
- On a loopback address, every request must name the server as
  `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>` in `Host`. Any
  other `Host` gets `421`. This stops a DNS rebinding page from reading
  tasks. On other addresses the server does not check `Host`.

`--allow-origin <origin>` lets one browser origin call the server, for
example a browser extension:

    npx @forkpoint/agent-lighthouse serve --allow-origin chrome-extension://<id>

The match is exact: scheme, host and port, with no wildcard. The flag
repeats. An allowed origin passes the `Origin` check, and every answer to
it carries `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`. Its
`OPTIONS` preflight gets `204` with
`Access-Control-Allow-Headers: Authorization, Content-Type` and
`Access-Control-Allow-Methods: GET, POST, DELETE`. A preflight from any
other origin gets `403`. The token still guards every POST and DELETE.

## Behind a proxy

Streaming fails silently when a proxy buffers the response. For nginx:

    location /tasks/ {
      proxy_pass http://127.0.0.1:8787;
      proxy_http_version 1.1;
      proxy_buffering off;
      proxy_read_timeout 1h;
    }

Keep nginx's default `Host` for a loopback upstream. Setting
`proxy_set_header Host $host` sends the public name, and the server answers
`421`. A browser POST through the proxy carries the public `Origin`, which
does not match that `Host`, so it gets `403`. Clients without `Origin` are
not affected.

The server sends a comment frame every 15 seconds, under nginx's 60-second
and Cloudflare's 120-second idle limits. Serve over HTTP/2 where possible:
browsers allow only six HTTP/1.1 connections per host, shared across tabs.
