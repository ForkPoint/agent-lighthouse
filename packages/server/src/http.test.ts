import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import {
  PhaseId,
  type ScanOptions,
  type ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { createTaskServer, type TaskServer } from "./http";
import { TaskStatus } from "./task-types";

vi.mock("@forkpoint/agent-lighthouse-core", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@forkpoint/agent-lighthouse-core")
  >()),
  isSafeUrl: vi.fn(async (url: string) => !url.includes("127.0.0.1")),
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

let http: Server;
let tasks: TaskServer;
let base: string;

beforeEach(async () => {
  tasks = createTaskServer({ scan, token: "s3cret", page: "<p>page</p>" });
  http = createServer((req, res) => tasks.handle(req, res));
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  tasks.close();
  release();
  await new Promise((r) => http.close(r));
});

const post = (
  body: unknown,
  token = "s3cret",
  extra: Record<string, string> = {},
) =>
  fetch(`${base}/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...extra,
    },
    body: JSON.stringify(body),
  });

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
});
