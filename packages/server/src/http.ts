import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isSafeUrl, runScan } from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore, type TaskStore } from "./task-store";
import { startScanTask, type RunningTask } from "./scan-task";
import { openTaskStream } from "./sse";
import { MAX_BODY_BYTES, MAX_RUNNING_TASKS, MAX_STREAMS } from "./limits";
import { FailureReason, TaskStatus } from "./task-types";
import { PAGE_HTML } from "./page";

export interface TaskServerOptions {
  store?: TaskStore;
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
}

export interface TaskServer {
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Cancels running scans. Call before closing the HTTP server. */
  close(): void;
}

const TASK_PATH = /^\/tasks\/([^/]+)(\/stream|\/updates|\/result)?$/;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
  const scan = options.scan ?? runScan;
  const page = options.page ?? PAGE_HTML;
  const running = new Map<string, RunningTask>();
  const allowedHosts =
    options.allowedHosts &&
    new Set(options.allowedHosts.map((h) => h.toLowerCase()));
  let streams = 0;

  const authorized = (req: IncomingMessage) =>
    options.token === undefined ||
    sameSecret(req.headers.authorization ?? "", `Bearer ${options.token}`);

  async function create(req: IncomingMessage, res: ServerResponse) {
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    // A cross-site form or no-cors fetch cannot send this type without a
    // preflight, which the server never answers.
    if (
      !req.headers["content-type"]?.toLowerCase().startsWith("application/json")
    )
      return json(res, 415, { error: "unsupported_media_type" });
    let target: URL;
    try {
      const body = (await readJson(req)) as { url?: unknown };
      if (typeof body.url !== "string") throw new Error("no url");
      target = new URL(body.url);
    } catch {
      return json(res, 400, { error: "invalid_request" });
    }
    if (!(await isSafeUrl(target.href)))
      return json(res, 422, { error: FailureReason.UnsafeTarget });
    // Counts scan promises, not task status: a cancelled task is terminal at
    // once, but its scan holds a slot until the promise settles.
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
    if ((req.method === "POST" || req.method === "DELETE") && !sameOrigin(req))
      return json(res, 403, { error: "forbidden_origin" });
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    if (req.method === "POST" && url.pathname === "/tasks")
      return create(req, res);

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
