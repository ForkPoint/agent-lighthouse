# Task server

`agent-lighthouse serve` runs scans as tasks and streams their progress to a
browser over Server-Sent Events.

    npx @forkpoint/agent-lighthouse serve --port 8787

Open `http://127.0.0.1:8787/` for the built-in page, or use the routes below.

## Flags

| Flag      | Meaning                                                                |
| :-------- | :--------------------------------------------------------------------- |
| `--port`  | Port to listen on. Default `8787`.                                     |
| `--host`  | Address to bind. Default `127.0.0.1`.                                  |
| `--token` | Bearer token for starting and cancelling scans. See [Access](#access). |

Flags accept both `--flag value` and `--flag=value`. A flag given without a
value fails with `Missing value for <flag>`. A value that starts with `-`
must use the `=` form, for example `--token=-abc`.

## Routes

| Method and path                  | Answer                                                                      |
| :------------------------------- | :-------------------------------------------------------------------------- |
| `POST /tasks`                    | Body `{"url": "https://…"}`. Returns `202 {"taskId", "snapshot"}`.          |
| `GET /tasks/:id`                 | The current snapshot.                                                       |
| `GET /tasks/:id/stream`          | SSE. A `snapshot` frame, then one `progress` frame per event.               |
| `GET /tasks/:id/updates?after=N` | Events after cursor `N`, plus the snapshot. For clients that cannot stream. |
| `GET /tasks/:id/result`          | The scan report as JSON, once the task succeeded.                           |
| `DELETE /tasks/:id`              | Cancels the task.                                                           |

A request with an invalid request target answers `400`.

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
were not assessed; `reasonCode` says why (`skipped`, `gated`, `budget`).

## Limits

Tasks live in memory. A restart loses them. Four scans run at once; more
answer `429`. A finished task stays readable for 60 minutes.

## Access

The server binds `127.0.0.1` by default. With `--host` set to another
address, set a token: starting and cancelling a scan then need
`Authorization: Bearer <token>`. Prefer the `AL_SERVER_TOKEN` environment
variable over `--token`. A token on the command line is visible to other
users in `ps`. Reads go by task id, a random UUID. Target URLs that resolve
to private or loopback addresses are refused.

## Behind a proxy

Streaming fails silently when a proxy buffers the response. For nginx:

    location /tasks/ {
      proxy_pass http://127.0.0.1:8787;
      proxy_http_version 1.1;
      proxy_buffering off;
      proxy_read_timeout 1h;
    }

The server sends a comment frame every 15 seconds, under nginx's 60-second
and Cloudflare's 120-second idle limits. Serve over HTTP/2 where possible:
browsers allow only six HTTP/1.1 connections per host, shared across tabs.
