import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuditOutcome,
  CheckStatus,
  logger,
  PhaseId,
  type AuditTrace,
  type ScanOptions,
  type ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore } from "./task-store";
import { scanEventToBody, startScanTask, traceToBody } from "./scan-task";
import { FailureReason, TaskStatus, WorkOutcome } from "./task-types";

const trace = (
  id: string,
  outcome: AuditOutcome,
  status: CheckStatus = CheckStatus.Pass,
) => ({ id, outcome, status }) as AuditTrace;
const stamp = { fraction: 0, elapsedMs: 0 };

describe("scanEventToBody", () => {
  it("maps phase events", () => {
    expect(
      scanEventToBody({
        type: "phase:start",
        phase: PhaseId.FetchPages,
        totalUnits: 2,
        ...stamp,
      }),
    ).toEqual({ type: "phase.started", phase: PhaseId.FetchPages, total: 2 });
    expect(
      scanEventToBody({
        type: "phase:total",
        phase: PhaseId.FetchPages,
        totalUnits: 3,
        ...stamp,
      }),
    ).toEqual({
      type: "phase.total_changed",
      phase: PhaseId.FetchPages,
      total: 3,
    });
    expect(
      scanEventToBody({
        type: "phase:done",
        phase: PhaseId.FetchPages,
        durationMs: 5,
        ...stamp,
      }),
    ).toEqual({ type: "phase.finished", phase: PhaseId.FetchPages });
  });

  it("maps fetch units", () => {
    expect(
      scanEventToBody({
        type: "unit:fail",
        phase: PhaseId.Analyze,
        label: "/p",
        error: "boom",
        ...stamp,
      }),
    ).toEqual({
      type: "work.settled",
      phase: PhaseId.Analyze,
      workId: "/p",
      outcome: WorkOutcome.Error,
    });
  });

  it("drops audit units and scan bookends", () => {
    expect(
      scanEventToBody({
        type: "unit:done",
        phase: PhaseId.Audits,
        completed: 1,
        total: 2,
        label: "x",
        ...stamp,
      }),
    ).toBeUndefined();
    expect(
      scanEventToBody({
        type: "scan:start",
        url: "https://shop.test/",
        ...stamp,
      }),
    ).toBeUndefined();
    expect(
      scanEventToBody({ type: "scan:done", durationMs: 1, score: 5, ...stamp }),
    ).toBeUndefined();
  });
});

describe("traceToBody", () => {
  it("keeps a failing verdict as completed work", () => {
    expect(
      traceToBody(trace("a/x", AuditOutcome.Ran, CheckStatus.Fail)),
    ).toEqual({
      type: "work.settled",
      phase: PhaseId.Audits,
      workId: "a/x",
      outcome: WorkOutcome.Completed,
      reasonCode: AuditOutcome.Ran,
      verdict: CheckStatus.Fail,
    });
  });

  it.each([AuditOutcome.Skipped, AuditOutcome.Gated, AuditOutcome.Budget])(
    "maps %s to skipped",
    (o) => {
      expect(traceToBody(trace("a/x", o))).toMatchObject({
        outcome: WorkOutcome.Skipped,
        reasonCode: o,
      });
    },
  );

  it("maps error to error", () => {
    expect(traceToBody(trace("a/x", AuditOutcome.Error))).toMatchObject({
      outcome: WorkOutcome.Error,
    });
  });
});

describe("startScanTask", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams progress and completes with the report", async () => {
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn(async (_url: string, o?: ScanOptions) => {
      o?.onEvent?.({
        type: "phase:start",
        phase: PhaseId.Audits,
        totalUnits: 1,
        ...stamp,
      });
      o?.onAuditTrace?.(trace("a/x", AuditOutcome.Ran));
      o?.onEvent?.({
        type: "phase:done",
        phase: PhaseId.Audits,
        durationMs: 1,
        ...stamp,
      });
      return { overallScore: 64 } as unknown as ScanReport;
    });
    await startScanTask(store, taskId, "https://shop.test/", scan).done;
    expect(store.get(taskId)).toMatchObject({
      status: TaskStatus.Succeeded,
      score: 64,
    });
    expect(store.get(taskId)?.phases[PhaseId.Audits]).toMatchObject({
      total: 1,
      completed: 1,
      finished: true,
    });
    expect(store.result(taskId)).toBeDefined();
  });

  it("fails with a safe reason code and no raw error text", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn(async () => {
      throw new Error("secret stack detail");
    });
    await startScanTask(store, taskId, "https://shop.test/", scan).done;
    expect(store.get(taskId)).toMatchObject({
      status: TaskStatus.Failed,
      reasonCode: FailureReason.ScanError,
    });
    expect(JSON.stringify(store.eventsAfter(taskId, 0))).not.toContain(
      "secret",
    );
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ taskId }),
      expect.any(String),
    );
  });

  it("resolves done even when the store throws on the terminal event", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const append = store.append.bind(store);
    vi.spyOn(store, "append").mockImplementation((id, body) => {
      if (body.type === "task.failed") throw new Error("store down");
      return append(id, body);
    });
    const scan = vi.fn(async () => {
      throw new Error("scan broke");
    });
    await expect(
      startScanTask(store, taskId, "https://shop.test/", scan).done,
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ taskId }),
      expect.any(String),
    );
  });

  it("cancels through the abort signal", async () => {
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn(
      (_url: string, o?: ScanOptions) =>
        new Promise<ScanReport>((_, reject) =>
          o?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    );
    const task = startScanTask(store, taskId, "https://shop.test/", scan);
    task.cancel();
    await task.done;
    expect(store.get(taskId)?.status).toBe(TaskStatus.Cancelled);
  });
});
