import { describe, it, expect } from "vitest";
import type { ScanEvent } from "@forkpoint/agent-lighthouse-core";
import { createProgressNotifier, type ProgressNotification } from "./progress";

const unitDone = (fraction: number): ScanEvent => ({
  type: "unit:done",
  phase: "audits",
  completed: 1,
  total: 207,
  fraction,
  elapsedMs: 0,
});

describe("createProgressNotifier", () => {
  it("returns undefined without a progressToken", () => {
    const sent: ProgressNotification[] = [];
    expect(
      createProgressNotifier(undefined, (n) => sent.push(n)),
    ).toBeUndefined();
  });

  it("maps events to { progressToken, progress: fraction, total: 1 }", () => {
    const sent: ProgressNotification[] = [];
    const handle = createProgressNotifier("tok-1", (n) => sent.push(n))!;
    handle({
      type: "phase:start",
      phase: "fetch-root",
      totalUnits: 34,
      fraction: 0.1,
      elapsedMs: 0,
    });
    expect(sent).toEqual([{ progressToken: "tok-1", progress: 0.1, total: 1 }]);
  });

  it("throttles to ~1 notification per interval", () => {
    const sent: ProgressNotification[] = [];
    let t = 0;
    const handle = createProgressNotifier(7, (n) => sent.push(n), {
      now: () => t,
    })!;
    handle(unitDone(0.1)); // t=0, first send allowed
    t = 100;
    handle(unitDone(0.2)); // throttled
    t = 500;
    handle(unitDone(0.3)); // throttled
    t = 1100;
    handle(unitDone(0.4)); // interval elapsed → sent
    expect(sent.map((n) => n.progress)).toEqual([0.1, 0.4]);
  });

  it("always sends the final 1.0 even inside the throttle window", () => {
    const sent: ProgressNotification[] = [];
    let t = 0;
    const handle = createProgressNotifier("tok", (n) => sent.push(n), {
      now: () => t,
    })!;
    handle(unitDone(0.99));
    t = 10;
    handle({
      type: "scan:done",
      durationMs: 10,
      score: 80,
      fraction: 1,
      elapsedMs: 10,
    });
    expect(sent.map((n) => n.progress)).toEqual([0.99, 1]);
  });

  it("ignores scan:start and unit:fail", () => {
    const sent: ProgressNotification[] = [];
    const handle = createProgressNotifier("tok", (n) => sent.push(n))!;
    handle({
      type: "scan:start",
      url: "https://x.test",
      fraction: 0,
      elapsedMs: 0,
    });
    handle({
      type: "unit:fail",
      phase: "audits",
      label: "3.1",
      error: "boom",
      fraction: 0.5,
      elapsedMs: 0,
    });
    expect(sent).toEqual([]);
  });
});
