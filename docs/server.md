# Task server

`agent-lighthouse serve` runs scans as tasks and streams their progress to a
browser over Server-Sent Events.

    npx @forkpoint/agent-lighthouse serve --port 8787

Open `http://127.0.0.1:8787/` for the built-in page, or use the routes below.

## Flags

| Flag      | Meaning                                                                                               |
| :-------- | :---------------------------------------------------------------------------------------------------- |
| `--port`  | Port to listen on. Default `8787`.                                                                    |
| `--host`  | Address to bind. Default `127.0.0.1`.                                                                 |
| `--token` | Bearer token for starting and cancelling scans. Defaults to `AL_SERVER_TOKEN`. See [Access](#access). |

Flags accept both `--flag value` and `--flag=value`. A flag given without a
value fails with `Missing value for <flag>`. A value that starts with `-`
must use the `=` form, for example `--token=-abc`.

## Routes

| Method and path                  | Answer                                                                                                                                                            |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /tasks`                    | Body `{"url": "https://…"}`. Returns `202 {"taskId", "snapshot"}`. Errors: `400`, `401`, `403`, `415`, `422`, `429`.                                              |
| `GET /tasks/:id`                 | The current snapshot. `404` for an unknown id.                                                                                                                    |
| `GET /tasks/:id/stream`          | SSE. A `snapshot` frame, then one `progress` frame per event. `404` for an unknown id, `429` when too many streams are open.                                      |
| `GET /tasks/:id/updates?after=N` | Events after cursor `N`, plus the snapshot. For clients that cannot stream. An `after` that is not an integer, or outside the kept events, returns `reset: true`. |
| `GET /tasks/:id/result`          | The scan report as JSON, once the task succeeded. `409 {"error": "not_ready", "status"}` before that.                                                             |
| `DELETE /tasks/:id`              | Cancels the task. Returns `202 {"snapshot"}`. Errors: `401`, `403`, `404`.                                                                                        |

Error statuses:

| Status | Body `error`             | Cause                                                                                               |
| :----- | :----------------------- | :-------------------------------------------------------------------------------------------------- |
| `400`  | `invalid_request`        | The body is not JSON with a string `url`, the URL does not parse, or the request target is invalid. |
| `401`  | `unauthorized`           | A token is set and the request does not carry it.                                                   |
| `403`  | `forbidden_origin`       | A POST or DELETE whose `Origin` host differs from its `Host`.                                       |
| `404`  | `not_found`              | No such route or task.                                                                              |
| `405`  | `method_not_allowed`     | A method the task route does not serve.                                                             |
| `409`  | `not_ready`              | The result of a task that has not succeeded.                                                        |
| `415`  | `unsupported_media_type` | A `POST /tasks` whose `content-type` is not `application/json`.                                     |
| `421`  | `misdirected_request`    | A loopback-bound server got a `Host` that is not a loopback name.                                   |
| `422`  | `unsafe_target`          | The target resolves to a private or loopback address.                                               |
| `429`  | `too_many_tasks`         | Four scans already run, or the task store is full.                                                  |
| `429`  | `too_many_streams`       | Too many SSE streams are open.                                                                      |

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
answer `429`. A finished task stays readable for 60 minutes.

## Access

The server binds `127.0.0.1` by default. With `--host` set to another
address, set a token: starting and cancelling a scan then need
`Authorization: Bearer <token>`. Prefer the `AL_SERVER_TOKEN` environment
variable over `--token`. A token on the command line is visible to other
users in `ps`. Reads go by task id, a random UUID. Target URLs that resolve
to private or loopback addresses are refused.

Three checks keep other web pages out of a local server:

- `POST /tasks` needs `content-type: application/json`. A page on another
  site cannot send that type without a CORS preflight, and the server
  answers none. Other types get `415`.
- A POST or DELETE with an `Origin` header whose host differs from the
  `Host` header gets `403`. Clients that send no `Origin`, such as `curl`,
  pass.
- On a loopback address, every request must name the server as
  `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>` in `Host`. Any
  other `Host` gets `421`. This stops a DNS rebinding page from reading
  tasks. On other addresses the server does not check `Host`.

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
