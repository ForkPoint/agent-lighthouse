import { describe, expect, it, vi } from "vitest";
import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore } from "./task-store";
import { MAX_EVENTS_PER_TASK, MAX_TASKS, TERMINAL_TTL_MS } from "./limits";
import { TaskStatus } from "./task-types";

const report = { overallScore: 81 } as unknown as ScanReport;

function makeStore(start = 0) {
  let now = start;
  let n = 0;
  const store = new InMemoryTaskStore({
    now: () => now,
    newId: () => `t${++n}`,
  });
  return { store, advance: (ms: number) => (now += ms) };
}

describe("InMemoryTaskStore", () => {
  it("creates a queued task at cursor 1", () => {
    const { store } = makeStore();
    const s = store.create("https://shop.test/");
    expect(s).toMatchObject({
      taskId: "t1",
      status: TaskStatus.Queued,
      cursor: 1,
    });
  });

  it("assigns contiguous cursors", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    expect(store.append("t1", { type: "task.started" })?.cursor).toBe(2);
    expect(store.append("t1", { type: "task.cancelled" })?.cursor).toBe(3);
  });

  it("refuses appends after a terminal event", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    store.append("t1", { type: "task.cancelled" });
    expect(store.append("t1", { type: "task.started" })).toBeUndefined();
  });

  it("stores the result before subscribers run on task.succeeded", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    let seenResult: ScanReport | undefined;
    let seenStatus: string | undefined;
    const listener = vi.fn(() => {
      // Read inside the listener: the result and snapshot are already set.
      seenResult = store.result("t1");
      seenStatus = store.get("t1")?.status;
    });
    store.subscribe("t1", listener);
    store.complete("t1", report);
    expect(listener).toHaveBeenCalledOnce();
    expect(seenResult).toBe(report);
    expect(seenStatus).toBe(TaskStatus.Succeeded);
    expect(store.get("t1")).toMatchObject({ score: 81 });
  });

  it("isolates a throwing listener from the task and other subscribers", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    const second = vi.fn();
    store.subscribe("t1", () => {
      throw new Error("socket closed");
    });
    store.subscribe("t1", second);
    const event = store.append("t1", { type: "task.started" });
    expect(event).toMatchObject({ cursor: 2 });
    expect(second).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 2 }),
      expect.objectContaining({ status: TaskStatus.Running }),
    );
    expect(store.get("t1")?.cursor).toBe(2);
  });

  it("notifies subscribers with the event and the new snapshot", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    const listener = vi.fn();
    const off = store.subscribe("t1", listener);
    store.append("t1", { type: "task.started" });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "task.started", cursor: 2 }),
      expect.objectContaining({ status: TaskStatus.Running, cursor: 2 }),
    );
    off();
    store.append("t1", { type: "task.cancelled" });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("returns events after a cursor", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    store.append("t1", { type: "task.started" });
    expect(store.eventsAfter("t1", 1)).toEqual({
      events: [expect.objectContaining({ cursor: 2 })],
      reset: false,
    });
  });

  it("asks for a reset when the cursor is outside retained history", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    for (let i = 0; i < MAX_EVENTS_PER_TASK + 5; i++)
      store.append("t1", { type: "task.started" });
    expect(store.eventsAfter("t1", 1)?.reset).toBe(true);
    expect(store.eventsAfter("t1", 999_999)?.reset).toBe(true);
  });

  it("expires a terminal task on read, with no new task created", () => {
    const { store, advance } = makeStore();
    store.create("https://shop.test/");
    store.complete("t1", report);
    advance(TERMINAL_TTL_MS);
    expect(store.get("t1")).toBeDefined();
    advance(1);
    expect(store.get("t1")).toBeUndefined();
    expect(store.result("t1")).toBeUndefined();
    expect(store.eventsAfter("t1", 0)).toBeUndefined();
  });

  it("never expires a live task", () => {
    const { store, advance } = makeStore();
    store.create("https://shop.test/");
    advance(TERMINAL_TTL_MS * 10);
    expect(store.get("t1")).toBeDefined();
  });

  it("drops the oldest terminal task when full, never a live one", () => {
    const { store } = makeStore();
    for (let i = 0; i < MAX_TASKS; i++) store.create(`https://s${i}.test/`);
    store.append("t2", { type: "task.cancelled" });
    expect(store.create("https://new.test/")).toBeDefined();
    expect(store.get("t1")).toBeDefined();
    expect(store.get("t2")).toBeUndefined();
  });

  it("refuses to create when every slot holds a live task", () => {
    const { store } = makeStore();
    for (let i = 0; i < MAX_TASKS; i++) store.create(`https://s${i}.test/`);
    expect(store.create("https://new.test/")).toBeUndefined();
    expect(store.get(`t${MAX_TASKS + 1}`)).toBeUndefined();
  });
});
