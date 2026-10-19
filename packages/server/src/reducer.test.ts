import { describe, expect, it } from "vitest";
import {
  AuditOutcome,
  CheckStatus,
  PhaseId,
} from "@forkpoint/agent-lighthouse-core";
import { applyTaskEvent, initialSnapshot } from "./reducer";
import {
  FailureReason,
  TaskStatus,
  WorkOutcome,
  type TaskEvent,
  type TaskEventBody,
} from "./task-types";

const T0 = "2026-10-18T00:00:00.000Z";
let cursor = 0;
const ev = (body: TaskEventBody): TaskEvent => ({
  ...body,
  taskId: "t1",
  cursor: ++cursor,
  occurredAt: T0,
});
const fold = (...bodies: TaskEventBody[]) => {
  cursor = 0;
  return bodies
    .map(ev)
    .reduce(applyTaskEvent, initialSnapshot("t1", "https://shop.test/", T0));
};

describe("applyTaskEvent", () => {
  it("starts queued", () => {
    expect(fold({ type: "task.queued" }).status).toBe(TaskStatus.Queued);
  });

  it("counts completed, error and skipped work apart", () => {
    const s = fold(
      { type: "task.queued" },
      { type: "task.started" },
      { type: "phase.started", phase: PhaseId.Audits, total: 3 },
      {
        type: "work.settled",
        phase: PhaseId.Audits,
        workId: "a/one",
        outcome: WorkOutcome.Completed,
        verdict: CheckStatus.Fail,
      },
      {
        type: "work.settled",
        phase: PhaseId.Audits,
        workId: "a/two",
        outcome: WorkOutcome.Error,
        reasonCode: AuditOutcome.Error,
      },
      {
        type: "work.settled",
        phase: PhaseId.Audits,
        workId: "a/three",
        outcome: WorkOutcome.Skipped,
        reasonCode: AuditOutcome.Gated,
      },
    );
    expect(s.status).toBe(TaskStatus.Running);
    expect(s.phase).toBe(PhaseId.Audits);
    expect(s.phases[PhaseId.Audits]).toEqual({
      total: 3,
      completed: 1,
      error: 1,
      skipped: 1,
      finished: false,
    });
    expect(s.lastWorkId).toBe("a/three");
  });

  it("applies a total change", () => {
    const s = fold(
      { type: "phase.started", phase: PhaseId.FetchPages, total: 1 },
      { type: "phase.total_changed", phase: PhaseId.FetchPages, total: 3 },
    );
    expect(s.phases[PhaseId.FetchPages]?.total).toBe(3);
  });

  it("marks a finished phase and clears the current phase", () => {
    const s = fold(
      { type: "phase.started", phase: PhaseId.Report, total: 1 },
      { type: "phase.finished", phase: PhaseId.Report },
    );
    expect(s.phase).toBeNull();
    expect(s.phases[PhaseId.Report]?.finished).toBe(true);
  });

  it("records success with the score", () => {
    const s = fold(
      { type: "task.started" },
      { type: "task.succeeded", score: 72 },
    );
    expect(s.status).toBe(TaskStatus.Succeeded);
    expect(s.score).toBe(72);
  });

  it("records a failure reason", () => {
    const s = fold(
      { type: "task.started" },
      { type: "task.failed", reasonCode: FailureReason.ScanError },
    );
    expect(s.status).toBe(TaskStatus.Failed);
    expect(s.reasonCode).toBe(FailureReason.ScanError);
  });

  it("ignores an event at or below the snapshot cursor", () => {
    const s = fold({ type: "task.queued" }, { type: "task.started" });
    const replay: TaskEvent = {
      type: "task.queued",
      taskId: "t1",
      cursor: 1,
      occurredAt: T0,
    };
    expect(applyTaskEvent(s, replay)).toBe(s);
  });

  it("never leaves a terminal state", () => {
    const s = fold({ type: "task.started" }, { type: "task.cancelled" });
    const late: TaskEvent = {
      type: "task.succeeded",
      score: 90,
      taskId: "t1",
      cursor: 3,
      occurredAt: T0,
    };
    expect(applyTaskEvent(s, late).status).toBe(TaskStatus.Cancelled);
  });
});
