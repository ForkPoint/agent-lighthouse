import {
  AuditOutcome,
  logger,
  LogField,
  PhaseId,
  runScan,
  type AuditTrace,
  type ScanEvent,
} from "@forkpoint/agent-lighthouse-core";
import type { TaskStore } from "./task-store";
import { FailureReason, WorkOutcome, type TaskEventBody } from "./task-types";

/**
 * One scan event as a task event, or undefined when the task stream does not
 * carry it. Audit units are dropped because each audit's AuditTrace says more:
 * whether it ran, was skipped, gated or cut by the budget, and its verdict.
 */
export function scanEventToBody(event: ScanEvent): TaskEventBody | undefined {
  switch (event.type) {
    case "phase:start":
      return {
        type: "phase.started",
        phase: event.phase,
        total: event.totalUnits,
      };
    case "phase:total":
      return {
        type: "phase.total_changed",
        phase: event.phase,
        total: event.totalUnits,
      };
    case "phase:done":
      return { type: "phase.finished", phase: event.phase };
    case "unit:done":
    case "unit:fail":
      if (event.phase === PhaseId.Audits) return undefined;
      return {
        type: "work.settled",
        phase: event.phase,
        workId: event.label ?? "unit",
        outcome:
          event.type === "unit:done"
            ? WorkOutcome.Completed
            : WorkOutcome.Error,
      };
    case "scan:start":
    case "scan:done":
      return undefined;
    default:
      return assertNever(event);
  }
}

/** Compile-time exhaustiveness check for the event switch. */
function assertNever(value: never): never {
  throw new Error(`Unhandled scan event: ${JSON.stringify(value)}`);
}

export function traceToBody(trace: AuditTrace): TaskEventBody {
  const outcome =
    trace.outcome === AuditOutcome.Ran
      ? WorkOutcome.Completed
      : trace.outcome === AuditOutcome.Error
        ? WorkOutcome.Error
        : WorkOutcome.Skipped;
  return {
    type: "work.settled",
    phase: PhaseId.Audits,
    workId: trace.id,
    outcome,
    reasonCode: trace.outcome,
    ...(trace.outcome === AuditOutcome.Ran && { verdict: trace.status }),
  };
}

export interface RunningTask {
  cancel(): void;
  /** Settles after the terminal event is stored. Never rejects. */
  done: Promise<void>;
}

/** Starts a scan in the background and records its progress in `store`. */
export function startScanTask(
  store: TaskStore,
  taskId: string,
  url: string,
  scan: typeof runScan = runScan,
): RunningTask {
  const controller = new AbortController();
  store.append(taskId, { type: "task.started" });
  const run = async (): Promise<void> => {
    try {
      const report = await scan(url, {
        signal: controller.signal,
        onEvent: (event) => {
          const body = scanEventToBody(event);
          if (body) store.append(taskId, body);
        },
        onAuditTrace: (trace) => store.append(taskId, traceToBody(trace)),
      });
      store.complete(taskId, report);
    } catch (error) {
      if (controller.signal.aborted) {
        store.append(taskId, { type: "task.cancelled" });
        return;
      }
      // The raw error stays in the server log; the task carries a code.
      logger.error({ taskId, [LogField.Error]: error }, "Scan task failed");
      store.append(taskId, {
        type: "task.failed",
        reasonCode: FailureReason.ScanError,
      });
    }
  };
  const done = run();
  return { cancel: () => controller.abort(), done };
}
