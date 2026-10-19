import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  BrowserSnapshotSchema,
  isSafeUrl,
  runScan,
} from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore, type TaskStore } from "./task-store";
import { startScanTask, type RunningTask } from "./scan-task";
import { openTaskStream } from "./sse";
import {
  MAX_BODY_BYTES,
  MAX_PAYLOAD_BODY_BYTES,
  MAX_RUNNING_DETECTS,
  MAX_RUNNING_TASKS,
  MAX_STREAMS,
} from "./limits";
import { FailureReason, TaskStatus } from "./task-types";
import { PAGE_HTML } from "./page";
import { InMemoryPayloadStore, type PayloadStore } from "./payload-store";
import { DetectError, detectSnapshot, detectUrl } from "./detect";

export interface TaskServerOptions {
  store?: TaskStore;
  /** Where `POST /detect` keeps payloads for a later scan. */
  payloads?: PayloadStore;
  /** When set, POST and DELETE need `Authorization: Bearer <token>`. */
  token?: string;
  scan?: typeof runScan;
  page?: string;
  /**
   * `Host` header values (`host:port`, lower case) the server answers. Any
   * other value gets 421. `startServer` sets it on a loopback bind so a DNS
   * rebinding page cannot read tasks. Absent: no Host check, for callers that
   * mount the handler behind their own routing.
   */
  allowedHosts?: string[];
  /**
   * Foreign origins, such as `chrome-extension://<id>`, that may call the
   * server from a browser. Exact match only. Such an origin passes the
   * foreign-Origin check, gets CORS headers and a preflight answer.
   */
  allowedOrigins?: string[];
}

export interface TaskServer {
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Cancels running scans. Call before closing the HTTP server. */
  close(): void;
}

const TASK_PATH = /^\/tasks\/([^/]+)(\/stream|\/updates|\/result)?$/;
const DETECT_PATH = /^\/detect\/([^/]+)$/;

/** Routes whose body may carry a page payload. */
const PAYLOAD_ROUTES = new Set(["/detect", "/tasks"]);

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

class BodyTooLarge extends Error {}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new BodyTooLarge("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** The body as an object, or a response already sent and undefined. */
async function readBody(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | undefined> {
  try {
    const body = await readJson(req, MAX_PAYLOAD_BODY_BYTES);
    if (typeof body === "object" && body !== null && !Array.isArray(body))
      return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BodyTooLarge) {
      json(res, 413, { error: "payload_too_large" });
      return undefined;
    }
  }
  json(res, 400, { error: "invalid_request" });
  return undefined;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time string compare; digests give both sides the same length. */
function sameSecret(presented: string, expected: string): boolean {
  return timingSafeEqual(sha256(presented), sha256(expected));
}

/**
 * True when the request carries no `Origin`, or one whose host is the request's
 * own `Host`. Browsers send `Origin` on every cross-origin POST and DELETE, so
 * this refuses a page on another site that tries to start or cancel a scan.
 */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === req.headers.host?.toLowerCase();
  } catch {
    // `Origin: null` and other opaque origins are never the server itself.
    return false;
  }
}

/** The target as a task shows it: without a `user:password@` part. */
function publicUrl(url: URL): string {
  const copy = new URL(url);
  copy.username = "";
  copy.password = "";
  return copy.href;
}

export function createTaskServer(options: TaskServerOptions = {}): TaskServer {
  const store = options.store ?? new InMemoryTaskStore();
  const payloads = options.payloads ?? new InMemoryPayloadStore();
  const scan = options.scan ?? runScan;
  const page = options.page ?? PAGE_HTML;
  const running = new Map<string, RunningTask>();
  const allowedHosts =
    options.allowedHosts &&
    new Set(options.allowedHosts.map((h) => h.toLowerCase()));
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  let streams = 0;
  let detecting = 0;

  const authorized = (req: IncomingMessage) =>
    options.token === undefined ||
    sameSecret(req.headers.authorization ?? "", `Bearer ${options.token}`);

  // A cross-site form or no-cors fetch cannot send this type without a
  // preflight, which the server answers only for an allowed origin.
  const declaresJson = (req: IncomingMessage) =>
    req.headers["content-type"]?.toLowerCase().startsWith("application/json");

  async function create(req: IncomingMessage, res: ServerResponse) {
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    if (!declaresJson(req))
      return json(res, 415, { error: "unsupported_media_type" });
    // Checked before the DNS lookup too, so refused requests cost no lookup.
    if (running.size >= MAX_RUNNING_TASKS)
      return json(res, 429, { error: "too_many_tasks" });
    const body = await readBody(req, res);
    if (!body) return;
    let target: URL;
    try {
      if (typeof body["url"] !== "string") throw new Error("no url");
      target = new URL(body["url"]);
    } catch {
      return json(res, 400, { error: "invalid_request" });
    }
    if (!(await isSafeUrl(target.href)))
      return json(res, 422, { error: FailureReason.UnsafeTarget });
    // Counts scan promises, not task status: a cancelled task is terminal at
    // once, but its scan holds a slot until the promise settles. Checked again
    // because other requests may have filled the cap during the lookup.
    if (running.size >= MAX_RUNNING_TASKS)
      return json(res, 429, { error: "too_many_tasks" });
    const snapshot = store.create(publicUrl(target));
    if (!snapshot) return json(res, 429, { error: "too_many_tasks" });
    const task = startScanTask(store, snapshot.taskId, target.href, scan);
    running.set(snapshot.taskId, task);
    void task.done.then(() => running.delete(snapshot.taskId));
    json(res, 202, {
      taskId: snapshot.taskId,
      snapshot: store.get(snapshot.taskId),
    });
  }

  async function detect(req: IncomingMessage, res: ServerResponse) {
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    if (!declaresJson(req))
      return json(res, 415, { error: "unsupported_media_type" });
    // The slot covers the body read too, so the cap also bounds the memory
    // that bodies in flight hold.
    if (detecting >= MAX_RUNNING_DETECTS)
      return json(
        res,
        429,
        { error: "too_many_detections" },
        { "retry-after": "1" },
      );
    detecting++;
    try {
      const body = await readBody(req, res);
      if (!body) return;
      const { url, snapshot } = body;
      if ((url === undefined) === (snapshot === undefined))
        return json(res, 400, {
          error: "invalid_request",
          message: "send exactly one of url or snapshot",
        });
      let detected;
      if (snapshot !== undefined) {
        const parsed = BrowserSnapshotSchema.safeParse(snapshot);
        if (!parsed.success) {
          const issue = parsed.error.issues[0]!;
          return json(res, 400, {
            error: "invalid_snapshot",
            message: issue.path.length
              ? `${issue.path.join(".")}: ${issue.message}`
              : issue.message,
          });
        }
        detected = detectSnapshot(parsed.data);
      } else {
        let target: URL;
        try {
          if (typeof url !== "string") throw new Error("no url");
          target = new URL(url);
        } catch {
          return json(res, 400, { error: "invalid_request" });
        }
        detected = await detectUrl(target, publicUrl(target));
      }
      const detectionId = payloads.put(detected);
      return json(res, 200, { detectionId, ...detected.identity });
    } catch (error) {
      if (!(error instanceof DetectError)) throw error;
      return json(res, error.status, {
        error: error.code,
        message: error.message,
      });
    } finally {
      detecting--;
    }
  }

  // Async so a synchronous throw becomes a rejection that `handle` catches.
  async function route(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      return json(res, 400, { error: "invalid_request" });
    }
    if (
      allowedHosts &&
      !allowedHosts.has(req.headers.host?.toLowerCase() ?? "")
    )
      return json(res, 421, { error: "misdirected_request" });

    const origin = req.headers.origin;
    const allowedOrigin = origin !== undefined && allowedOrigins.has(origin);
    if (req.method === "OPTIONS") {
      if (!allowedOrigin) return json(res, 403, { error: "forbidden_origin" });
      res.writeHead(204, {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-allow-methods": "GET, POST, DELETE",
        vary: "Origin",
      });
      res.end();
      return;
    }
    if (allowedOrigin) {
      // Every answer, errors included, so the extension can read why.
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "Origin");
    }
    if (
      (req.method === "POST" || req.method === "DELETE") &&
      !allowedOrigin &&
      !sameOrigin(req)
    )
      return json(res, 403, { error: "forbidden_origin" });

    // A declared length over the route's limit is refused before any read.
    // The two payload routes also count the bytes as they stream in.
    const bodyLimit =
      req.method === "POST" && PAYLOAD_ROUTES.has(url.pathname)
        ? MAX_PAYLOAD_BODY_BYTES
        : MAX_BODY_BYTES;
    if (Number(req.headers["content-length"] ?? 0) > bodyLimit)
      return json(res, 413, { error: "payload_too_large" });

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    if (req.method === "POST" && url.pathname === "/tasks")
      return create(req, res);
    if (req.method === "POST" && url.pathname === "/detect")
      return detect(req, res);

    const detection = DETECT_PATH.exec(url.pathname);
    if (detection) {
      if (req.method !== "DELETE")
        return json(res, 405, { error: "method_not_allowed" });
      if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
      if (!payloads.delete(detection[1]!))
        return json(res, 404, { error: "not_found" });
      res.writeHead(204, { "cache-control": "no-store" });
      res.end();
      return;
    }

    const match = TASK_PATH.exec(url.pathname);
    if (!match) return json(res, 404, { error: "not_found" });
    const [, taskId, sub] = match as unknown as [
      string,
      string,
      string | undefined,
    ];
    const snapshot = store.get(taskId);
    if (!snapshot) return json(res, 404, { error: "not_found" });

    if (req.method === "DELETE" && sub === undefined) {
      if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
      running.get(taskId)?.cancel();
      // A scan that ignores its signal still ends as cancelled for viewers.
      store.append(taskId, { type: "task.cancelled" });
      return json(res, 202, { snapshot: store.get(taskId) });
    }
    if (req.method !== "GET")
      return json(res, 405, { error: "method_not_allowed" });

    switch (sub) {
      case undefined:
        return json(res, 200, snapshot);
      case "/stream":
        if (streams >= MAX_STREAMS)
          return json(res, 429, { error: "too_many_streams" });
        streams++;
        return openTaskStream(store, taskId, res, () => streams--);
      case "/updates": {
        const after = Number(url.searchParams.get("after") ?? "0");
        const batch = store.eventsAfter(
          taskId,
          Number.isInteger(after) ? after : -1,
        )!;
        return json(res, 200, { ...batch, snapshot: store.get(taskId) });
      }
      case "/result": {
        const result = store.result(taskId);
        if (snapshot.status !== TaskStatus.Succeeded || !result)
          return json(res, 409, {
            error: "not_ready",
            status: snapshot.status,
          });
        return json(res, 200, result);
      }
    }
  }

  return {
    handle(req, res) {
      route(req, res).catch(() => {
        if (!res.headersSent) json(res, 500, { error: "internal" });
        else res.destroy();
      });
    },
    close() {
      for (const [taskId, task] of running) {
        task.cancel();
        store.append(taskId, {
          type: "task.failed",
          reasonCode: FailureReason.Shutdown,
        });
      }
    },
  };
}
