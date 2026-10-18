import { afterEach, describe, expect, it } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { PAGE_HTML } from "./page";
import { TaskStatus } from "./task-types";

type Listener = (e: { data: string }) => void;
type FakeFetch = (url: string, init?: { method?: string }) => Promise<unknown>;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  closed = false;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Listener[]>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close(): void {
    this.closed = true;
  }
  /** Delivers a frame, even after close(): it models a frame already queued. */
  emit(type: string, data: unknown): void {
    for (const fn of this.listeners.get(type) ?? [])
      fn({ data: JSON.stringify(data) });
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

const snap = (
  taskId: string,
  cursor: number,
  status: string = TaskStatus.Queued,
  extra = {},
) => ({
  taskId,
  url: "https://shop.test/",
  status,
  cursor,
  phase: null,
  phases: {},
  lastWorkId: null,
  score: null,
  reasonCode: null,
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
  ...extra,
});

/** Settles pending promise callbacks inside the page. */
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Anything jsdom would print (script errors, "Not implemented") lands here. */
const consoleProblems: string[] = [];

afterEach(() => {
  // Checked after every test so a page error cannot pass unnoticed.
  expect(consoleProblems).toEqual([]);
});

function openPage(
  fetchImpl: FakeFetch,
  withEventSource = true,
  setTimeoutImpl?: (fn: () => void, ms: number) => unknown,
) {
  FakeEventSource.instances = [];
  consoleProblems.length = 0;
  const virtualConsole = new VirtualConsole();
  const record =
    (level: string) =>
    (...args: unknown[]) => {
      consoleProblems.push(`${level}: ${args.map(String).join(" ")}`);
    };
  virtualConsole.on("error", record("error"));
  virtualConsole.on("warn", record("warn"));
  virtualConsole.on("jsdomError", record("jsdomError"));
  const dom = new JSDOM(PAGE_HTML, {
    url: "http://127.0.0.1:8787/",
    runScripts: "dangerously",
    virtualConsole,
    beforeParse(window) {
      Object.assign(window, { fetch: fetchImpl });
      if (withEventSource)
        Object.assign(window, { EventSource: FakeEventSource });
      if (setTimeoutImpl) Object.assign(window, { setTimeout: setTimeoutImpl });
    },
  });
  const { document } = dom.window;
  return {
    submit(url: string) {
      (document.getElementById("url") as HTMLInputElement).value = url;
      document
        .getElementById("f")!
        .dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    },
    text: (id: string) => document.getElementById(id)!.textContent,
  };
}

describe("page watcher", () => {
  it("watches only the last of two fast submissions, whichever reply lands first", async () => {
    const posts = [deferred<unknown>(), deferred<unknown>()];
    let n = 0;
    const page = openPage(() => posts[n++]!.promise);
    page.submit("https://a.test/");
    page.submit("https://b.test/");
    posts[1]!.resolve(ok({ taskId: "B", snapshot: snap("B", 1) }));
    await tick();
    // The first submission's reply arrives last and must change nothing.
    posts[0]!.resolve(ok({ taskId: "A", snapshot: snap("A", 1) }));
    await tick();
    expect(FakeEventSource.instances.map((e) => e.url)).toEqual([
      "tasks/B/stream",
    ]);
    FakeEventSource.instances[0]!.emit("progress", {
      event: {},
      snapshot: snap("B", 2, TaskStatus.Succeeded, { score: 42 }),
    });
    expect(page.text("result")).toContain("Score: 42");
  });

  it("closes the first stream and ignores its late frames", async () => {
    const replies = [
      ok({ taskId: "A", snapshot: snap("A", 1) }),
      ok({ taskId: "B", snapshot: snap("B", 1) }),
    ];
    let n = 0;
    const page = openPage(async () => replies[n++]);
    page.submit("https://a.test/");
    await tick();
    const a = FakeEventSource.instances[0]!;
    a.emit("progress", {
      event: {},
      snapshot: snap("A", 2, TaskStatus.Running, { lastWorkId: "/robots.txt" }),
    });
    expect(page.text("status")).toBe("Running. Last checked: /robots.txt");

    page.submit("https://b.test/");
    await tick();
    expect(a.closed).toBe(true);
    const b = FakeEventSource.instances[1]!;
    expect(b.url).toBe("tasks/B/stream");

    // Late frames from the first scan, with a higher cursor than B's.
    a.emit("progress", {
      event: {},
      snapshot: snap("A", 9, TaskStatus.Succeeded, { score: 99 }),
    });
    a.emit("snapshot", snap("A", 9, TaskStatus.Succeeded, { score: 99 }));
    expect(page.text("result")).toBe("");
    expect(page.text("status")).toBe("Waiting to start.");

    b.emit("progress", {
      event: {},
      snapshot: snap("B", 2, TaskStatus.Running, { lastWorkId: "/llms.txt" }),
    });
    expect(page.text("status")).toBe("Running. Last checked: /llms.txt");
  });

  it("stops the first poll loop and drops its in-flight reply", async () => {
    const firstPoll = deferred<unknown>();
    const calls: string[] = [];
    // The page's own setTimeout is replaced, so the test decides when a
    // 3-second poll delay elapses. Nothing waits in real time.
    const timers: { fn: () => void; ms: number }[] = [];
    let posts = 0;
    const page = openPage(
      async (url, init) => {
        calls.push(url);
        if (init?.method === "POST")
          return ++posts === 1
            ? ok({ taskId: "A", snapshot: snap("A", 1) })
            : ok({ taskId: "B", snapshot: snap("B", 1) });
        if (url.startsWith("tasks/A/")) return firstPoll.promise;
        // The second task's poll stays pending for the rest of the test.
        return new Promise(() => {});
      },
      false,
      (fn, ms) => timers.push({ fn, ms }),
    );

    page.submit("https://a.test/");
    await tick();
    expect(calls).toContain("tasks/A/updates?after=1");

    page.submit("https://b.test/");
    await tick();
    // Not terminal: only cancellation can stop the first loop now.
    firstPoll.resolve(
      ok({
        events: [],
        reset: false,
        snapshot: snap("A", 9, TaskStatus.Running, { lastWorkId: "/late" }),
      }),
    );
    await tick();
    // Let every scheduled poll delay elapse, then give the loop a chance to run.
    for (const t of timers.splice(0)) t.fn();
    await tick();

    expect(page.text("status")).toBe("Waiting to start.");
    expect(calls.filter((c) => c.startsWith("tasks/A/"))).toHaveLength(1);
    expect(calls).toContain("tasks/B/updates?after=1");
  });
});
