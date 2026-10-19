import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import {
  CaptureSource,
  ClassificationConfidence,
  DOM_WORK_LIMITS,
  DocumentState,
  isSafeUrl,
  PageType,
  PageTypeSource,
  PayloadOrigin,
  PhaseId,
  type BrowserSnapshot,
  type FetchResult,
  type ScanOptions,
  type ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { createTaskServer, type TaskServer } from "./http";
import { TaskStatus } from "./task-types";
import { MAX_PAYLOAD_BODY_BYTES, MAX_RUNNING_DETECTS } from "./limits";

// The page fetch of a URL detection answers from this map; nothing reaches
// the network. A URL in `hold` waits until `releaseFetches()`.
const net = vi.hoisted(() => ({
  pages: new Map<string, Partial<FetchResult>>(),
  calls: [] as string[],
  held: [] as (() => void)[],
  hold: new Set<string>(),
}));
const releaseFetches = () => net.held.splice(0).forEach((go) => go());

vi.mock("@forkpoint/agent-lighthouse-core", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@forkpoint/agent-lighthouse-core")
  >()),
  isSafeUrl: vi.fn(async (url: string) => !url.includes("127.0.0.1")),
  createFetcher: () => ({
    fetch: async ({ url }: { url: string }): Promise<FetchResult> => {
      net.calls.push(url);
      if (net.hold.has(url))
        await new Promise<void>((resolve) => net.held.push(resolve));
      return {
        url,
        finalUrl: url,
        status: 200,
        headers: { "content-type": "text/html" },
        body: "",
        ttfbMs: 0,
        totalMs: 0,
        contentType: "text/html",
        contentLength: 0,
        ...net.pages.get(url),
      };
    },
    summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
  }),
}));

const stamp = { fraction: 0, elapsedMs: 0 };
// Each mock scan waits until release() settles every pending scan. The scans
// ignore their abort signal on purpose, like a scan stuck in a slow request.
const pending: (() => void)[] = [];
const release = () => pending.splice(0).forEach((resolve) => resolve());
const scan = vi.fn((_url: string, o?: ScanOptions) => {
  o?.onEvent?.({
    type: "phase:start",
    phase: PhaseId.FetchRoot,
    totalUnits: 1,
    ...stamp,
  });
  return new Promise<ScanReport>((resolve) => {
    pending.push(() => resolve({ overallScore: 70 } as unknown as ScanReport));
  });
});

const EXTENSION = "chrome-extension://abcdefghijklmnop";

let http: Server;
let tasks: TaskServer;
let base: string;

beforeEach(async () => {
  tasks = createTaskServer({
    scan,
    token: "s3cret",
    page: "<p>page</p>",
    allowedOrigins: [EXTENSION],
  });
  http = createServer((req, res) => tasks.handle(req, res));
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  tasks.close();
  release();
  releaseFetches();
  net.pages.clear();
  net.calls.length = 0;
  net.hold.clear();
  await new Promise((r) => http.close(r));
});

const post = (
  body: unknown,
  token = "s3cret",
  extra: Record<string, string> = {},
  path = "/tasks",
) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...extra,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const detect = (body: unknown, extra: Record<string, string> = {}) =>
  post(body, "s3cret", extra, "/detect");

/** Reads SSE frames until `stop` returns true. */
async function readFrames(
  res: Response,
  stop: (f: { event: string; data: any }[]) => boolean,
) {
  const frames: { event: string; data: any }[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (!stop(frames)) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (event && data) frames.push({ event, data: JSON.parse(data) });
    }
  }
  await reader.cancel();
  return frames;
}

describe("task routes", () => {
  it("serves the page", async () => {
    expect(await (await fetch(`${base}/`)).text()).toBe("<p>page</p>");
  });

  it("refuses a POST without the token", async () => {
    expect((await post({ url: "https://shop.test/" }, "wrong")).status).toBe(
      401,
    );
  });

  it("refuses a bad body and an unsafe target", async () => {
    expect((await post({ nope: 1 })).status).toBe(400);
    expect((await post({ url: "http://127.0.0.1/" })).status).toBe(422);
  });

  it("creates a task and reads its snapshot", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const snap = await (await fetch(`${base}/tasks/${taskId}`)).json();
    expect(snap.status).toBe(TaskStatus.Running);
    expect((await fetch(`${base}/tasks/nope`)).status).toBe(404);
  });

  it("streams a snapshot, then progress, then ends on success", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const res = await fetch(`${base}/tasks/${taskId}/stream`);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    setTimeout(() => release(), 20);
    const frames = await readFrames(
      res,
      (f) => f.at(-1)?.data.snapshot?.status === TaskStatus.Succeeded,
    );
    expect(frames[0]!.event).toBe("snapshot");
    expect(frames.at(-1)!.event).toBe("progress");
    expect(frames.at(-1)!.data.event.type).toBe("task.succeeded");
    const cursors = frames.slice(1).map((f) => f.data.event.cursor);
    expect(cursors).toEqual([...cursors].sort((a, b) => a - b));
    expect((await fetch(`${base}/tasks/${taskId}/result`)).status).toBe(200);
  });

  it("serves the same state to a poller", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const body = await (
      await fetch(`${base}/tasks/${taskId}/updates?after=1`)
    ).json();
    expect(body.reset).toBe(false);
    expect(body.events[0].cursor).toBe(2);
    expect(body.snapshot.cursor).toBe(body.events.at(-1).cursor);
  });

  it("answers 409 for a result that is not ready", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    expect((await fetch(`${base}/tasks/${taskId}/result`)).status).toBe(409);
  });

  it("cancels a task", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const del = await fetch(`${base}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(del.status).toBe(202);
    // The mock scan ignores the signal, so cancel is recorded by the server itself.
    const snap = await (await fetch(`${base}/tasks/${taskId}`)).json();
    expect(snap.status).toBe(TaskStatus.Cancelled);
  });

  it("keeps a cancelled scan's slot until its promise settles", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++)
      ids.push(
        (await (await post({ url: `https://s${i}.test/` })).json()).taskId,
      );
    await fetch(`${base}/tasks/${ids[0]}`, {
      method: "DELETE",
      headers: { authorization: "Bearer s3cret" },
    });
    expect((await post({ url: "https://five.test/" })).status).toBe(429);
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect((await post({ url: "https://five.test/" })).status).toBe(202);
  });

  it("answers 400 to an unparseable request target and stays up", async () => {
    const port = (http.address() as AddressInfo).port;
    const raw = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, "127.0.0.1");
      let data = "";
      socket.on("data", (chunk) => (data += chunk.toString()));
      socket.on("end", () => resolve(data));
      socket.on("error", reject);
      socket.write("GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n");
    });
    expect(raw.startsWith("HTTP/1.1 400")).toBe(true);
    expect((await fetch(`${base}/`)).status).toBe(200);
  });

  it("refuses a POST whose body is not declared as JSON", async () => {
    const res = await post({ url: "https://shop.test/" }, "s3cret", {
      "content-type": "text/plain",
    });
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "unsupported_media_type" });
  });

  it("refuses a POST and a DELETE from a foreign origin", async () => {
    const res = await post({ url: "https://shop.test/" }, "s3cret", {
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden_origin" });

    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const del = await fetch(`${base}/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        authorization: "Bearer s3cret",
        origin: "https://evil.example",
      },
    });
    expect(del.status).toBe(403);
  });

  it("accepts a POST from its own origin", async () => {
    const res = await post({ url: "https://shop.test/" }, "s3cret", {
      origin: base,
    });
    expect(res.status).toBe(202);
  });

  it("refuses a POST when the scan cap is full without resolving the target", async () => {
    for (let i = 0; i < 4; i++)
      expect((await post({ url: `https://s${i}.test/` })).status).toBe(202);
    vi.mocked(isSafeUrl).mockClear();
    expect((await post({ url: "https://five.test/" })).status).toBe(429);
    expect(isSafeUrl).not.toHaveBeenCalled();
  });

  it("shows the target without credentials but scans it with them", async () => {
    scan.mockClear();
    const res = await post({ url: "https://u:p@shop.test/" });
    const { snapshot } = await res.json();
    expect(snapshot.url).toBe("https://shop.test/");
    expect(scan).toHaveBeenCalledWith(
      "https://u:p@shop.test/",
      expect.anything(),
    );
  });
});

const PRODUCT_HTML = `<html><head><meta property="og:type" content="product"></head><body><main><h1>Blue mug</h1><p>A mug.</p></main></body></html>`;
const sha = (html: string) => createHash("sha256").update(html).digest("hex");

function capture(overrides: Partial<BrowserSnapshot> = {}): BrowserSnapshot {
  return {
    requestedUrl: "https://shop.test/p/1",
    capturedUrl: "https://shop.test/p/1",
    html: PRODUCT_HTML,
    capturedAt: "2026-10-19T10:00:00Z",
    captureSource: CaptureSource.CurrentTab,
    collector: { name: "extension", version: "1.0" },
    documentState: DocumentState.Complete,
    truncation: { truncated: false },
    redaction: { redacted: false, fields: [] },
    ...overrides,
  };
}

describe("POST /detect", () => {
  it("detects a fetched URL with one request and keeps the payload", async () => {
    net.pages.set("https://shop.test/p/1", { body: PRODUCT_HTML });
    const res = await detect({ url: "https://shop.test/p/1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      url: "https://shop.test/p/1",
      type: PageType.Product,
      confidence: ClassificationConfidence.Strong,
      payloadSha256: sha(PRODUCT_HTML),
      origin: PayloadOrigin.Fetched,
      partial: false,
    });
    expect(body.detectionId).toMatch(/^d_[0-9a-f]{32}$/);
    expect(net.calls).toEqual(["https://shop.test/p/1"]);
  });

  it("reports a gateway's target without following it", async () => {
    net.pages.set("https://shop.test/", {
      body: `<html><head><meta http-equiv="refresh" content="0;url=/en/"></head><body></body></html>`,
    });
    const body = await (await detect({ url: "https://shop.test/" })).json();
    expect(body.gatewayTarget).toBe("https://shop.test/en/");
    expect(net.calls).toEqual(["https://shop.test/"]);
  });

  it("detects a supplied snapshot without a fetch", async () => {
    const res = await detect({ snapshot: capture() });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      type: PageType.Product,
      origin: PayloadOrigin.Supplied,
      partial: false,
      payloadSha256: sha(PRODUCT_HTML),
    });
    expect(net.calls).toEqual([]);
  });

  it.each([
    ["truncated", { truncation: { truncated: true } }],
    ["redacted", { redaction: { redacted: true, fields: ["email"] } }],
    ["loading", { documentState: DocumentState.Loading }],
  ])("treats a %s snapshot as partial", async (_name, overrides) => {
    const body = await (await detect({ snapshot: capture(overrides) })).json();
    expect(body.partial).toBe(true);
    expect(body.confidence).toBe(ClassificationConfidence.Hint);
  });

  it("refuses a missing or wrong token", async () => {
    const res = await post(
      { url: "https://shop.test/" },
      "wrong",
      {},
      "/detect",
    );
    expect(res.status).toBe(401);
  });

  it("refuses a foreign Origin and accepts an allowed one with CORS headers", async () => {
    const foreign = await detect(
      { snapshot: capture() },
      { origin: "https://evil.example" },
    );
    expect(foreign.status).toBe(403);
    const allowed = await detect(
      { snapshot: capture() },
      { origin: EXTENSION },
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(EXTENSION);
    expect(allowed.headers.get("vary")).toBe("Origin");
  });

  it("refuses a body not declared as JSON", async () => {
    const res = await detect(
      { snapshot: capture() },
      { "content-type": "text/plain" },
    );
    expect(res.status).toBe(415);
  });

  it("refuses a body over the payload limit", async () => {
    const res = await detect("x".repeat(MAX_PAYLOAD_BODY_BYTES + 1));
    expect(res.status).toBe(413);
  });

  it("refuses both url and snapshot, or neither", async () => {
    expect(
      (await detect({ url: "https://shop.test/", snapshot: capture() })).status,
    ).toBe(400);
    expect((await detect({})).status).toBe(400);
    expect((await detect("not json")).status).toBe(400);
  });

  it("answers 400 with the first schema error for a bad snapshot", async () => {
    const res = await detect({
      snapshot: capture({ capturedUrl: "https://other.test/" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_snapshot");
    expect(body.message).toContain("Captured URL does not match");
  });

  it("refuses an unsafe URL", async () => {
    const res = await detect({ url: "http://127.0.0.1/" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("unsafe URL");
    expect(net.calls).toEqual([]);
  });

  it("answers 502 with the fetch error text", async () => {
    net.pages.set("https://down.test/", { status: 0, error: "ECONNREFUSED" });
    const res = await detect({ url: "https://down.test/" });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe("ECONNREFUSED");
  });

  it("answers 422 for a page that is not HTML", async () => {
    net.pages.set("https://shop.test/a.json", {
      body: "{}",
      contentType: "application/json",
      headers: { "content-type": "application/json" },
    });
    const res = await detect({ url: "https://shop.test/a.json" });
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe("not an HTML page");
  });

  it("answers 422 for a page that answers an HTTP error", async () => {
    net.pages.set("https://shop.test/gone", { status: 404, body: "<p>no</p>" });
    const res = await detect({ url: "https://shop.test/gone" });
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe("page returned HTTP 404");
  });

  it("answers 422 for a page over the DOM work limits", async () => {
    const res = await detect({
      snapshot: capture({
        html: "<div>".repeat(DOM_WORK_LIMITS.maxDepth + 5),
      }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe("page too deep to assess");
  });

  it("answers 429 with Retry-After once the detect cap is full", async () => {
    net.hold.add("https://slow.test/");
    const slow = Array.from({ length: MAX_RUNNING_DETECTS }, () =>
      detect({ url: "https://slow.test/" }),
    );
    await vi.waitFor(() => expect(net.held).toHaveLength(MAX_RUNNING_DETECTS));
    const refused = await detect({ snapshot: capture() });
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("1");
    releaseFetches();
    for (const res of await Promise.all(slow)) expect(res.status).toBe(200);
    expect((await detect({ snapshot: capture() })).status).toBe(200);
  });
});

describe("DELETE /detect/:id", () => {
  it("removes an entry, with the token", async () => {
    const { detectionId } = await (
      await detect({ snapshot: capture() })
    ).json();
    const del = (token: string) =>
      fetch(`${base}/detect/${detectionId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
    expect((await del("wrong")).status).toBe(401);
    expect((await del("s3cret")).status).toBe(204);
    expect((await del("s3cret")).status).toBe(404);
  });
});

describe("CORS preflight", () => {
  const preflight = (origin: string) =>
    fetch(`${base}/detect`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      },
    });

  it("answers an allowed origin with 204 and the exact CORS headers", async () => {
    const res = await preflight(EXTENSION);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXTENSION);
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Authorization, Content-Type",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, DELETE",
    );
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("refuses any other origin with 403", async () => {
    const res = await preflight("https://evil.example");
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    // Exact match only: a prefix of an allowed origin is another origin.
    expect((await preflight(`${EXTENSION}x`)).status).toBe(403);
  });
});

describe("body limits", () => {
  const big = { url: "https://shop.test/", pad: "x".repeat(100 * 1024) };

  it("lets POST /detect and POST /tasks carry more than 16 KiB", async () => {
    expect((await detect(big)).status).toBe(200);
    expect((await post(big)).status).toBe(202);
  });

  it("keeps 16 KiB on every other route", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const res = await fetch(`${base}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer s3cret" },
      body: JSON.stringify(big),
    });
    expect(res.status).toBe(413);
  });
});

describe("POST /tasks with detectionId", () => {
  const lastOptions = () => scan.mock.calls.at(-1)![1]!;

  it("scans the stored target with the stored response and its identity", async () => {
    net.pages.set("https://shop.test/p/1", { body: PRODUCT_HTML });
    const { detectionId } = await (
      await detect({ url: "https://shop.test/p/1" })
    ).json();
    scan.mockClear();
    const res = await post({ detectionId });
    expect(res.status).toBe(202);
    expect((await res.json()).snapshot.url).toBe("https://shop.test/p/1");
    expect(scan.mock.calls[0]![0]).toBe("https://shop.test/p/1");
    const options = lastOptions();
    expect(options.targetPage?.body).toBe(PRODUCT_HTML);
    expect(options.snapshots).toBeUndefined();
    // A detected type is never handed over as a declared one.
    expect(options.pageType).toBeUndefined();
    expect(options.pageIdentity).toEqual({
      type: PageType.Product,
      source: PageTypeSource.Detected,
      detectionId,
      payloadSha256: sha(PRODUCT_HTML),
      origin: PayloadOrigin.Fetched,
    });
  });

  it("feeds a supplied payload to the scan as its snapshot", async () => {
    const { detectionId } = await (
      await detect({ snapshot: capture() })
    ).json();
    scan.mockClear();
    expect((await post({ detectionId })).status).toBe(202);
    const options = lastOptions();
    expect(options.snapshots).toEqual({ version: 1, pages: [capture()] });
    expect(options.targetPage).toBeUndefined();
    expect(options.pageIdentity?.origin).toBe(PayloadOrigin.Supplied);
  });

  it("keeps the entry, so a failed start can retry", async () => {
    const { detectionId } = await (
      await detect({ snapshot: capture() })
    ).json();
    expect((await post({ detectionId })).status).toBe(202);
    expect((await post({ detectionId })).status).toBe(202);
  });

  it("refuses a detectionId sent with url or snapshot", async () => {
    const { detectionId } = await (
      await detect({ snapshot: capture() })
    ).json();
    expect(
      (await post({ detectionId, url: "https://shop.test/p/1" })).status,
    ).toBe(400);
    expect((await post({ detectionId, snapshot: capture() })).status).toBe(400);
  });

  it("answers 404 for an unknown or expired detectionId", async () => {
    const res = await post({ detectionId: "d_unknown" });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe(
      "detection expired; detect again or send the payload",
    );
  });
});

describe("POST /tasks with a plain snapshot", () => {
  it("scans the snapshot's URL with the snapshot", async () => {
    scan.mockClear();
    const res = await post({ snapshot: capture() });
    expect(res.status).toBe(202);
    expect(scan.mock.calls[0]![0]).toBe("https://shop.test/p/1");
    expect(scan.mock.calls[0]![1]!.snapshots?.pages).toHaveLength(1);
    expect(scan.mock.calls[0]![1]!.pageIdentity).toBeUndefined();
  });

  it("refuses a snapshot of another page than the url", async () => {
    expect(
      (await post({ url: "https://shop.test/other", snapshot: capture() }))
        .status,
    ).toBe(400);
    expect(
      (await post({ snapshot: capture({ capturedAt: "yesterday" }) })).status,
    ).toBe(400);
  });
});
