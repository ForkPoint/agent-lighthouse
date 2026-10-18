import type {
  AuditOutcome,
  CheckStatus,
  PhaseId,
} from "@forkpoint/agent-lighthouse-core";

export const TaskStatus = {
  Queued: "queued",
  Running: "running",
  Succeeded: "succeeded",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** How one unit of work settled. A failing audit verdict is still `completed`. */
export const WorkOutcome = {
  Completed: "completed",
  Error: "error",
  Skipped: "skipped",
} as const;
export type WorkOutcome = (typeof WorkOutcome)[keyof typeof WorkOutcome];

/** Safe reason codes. Raw error text never leaves the server. */
export const FailureReason = {
  ScanError: "scan_error",
  UnsafeTarget: "unsafe_target",
  Shutdown: "shutdown",
} as const;
export type FailureReason = (typeof FailureReason)[keyof typeof FailureReason];

export type TaskEventBody =
  | { type: "task.queued" }
  | { type: "task.started" }
  | { type: "phase.started"; phase: PhaseId; total: number }
  | { type: "phase.total_changed"; phase: PhaseId; total: number }
  | {
      type: "work.settled";
      phase: PhaseId;
      workId: string;
      outcome: WorkOutcome;
      /** The audit's trace outcome, when the work is an audit. */
      reasonCode?: AuditOutcome;
      /** The audit's verdict, when it ran. */
      verdict?: CheckStatus;
    }
  | { type: "phase.finished"; phase: PhaseId }
  | { type: "task.succeeded"; score: number | null }
  | { type: "task.failed"; reasonCode: FailureReason }
  | { type: "task.cancelled" };

export type TaskEvent = TaskEventBody & {
  taskId: string;
  /** 1-based, contiguous, increasing per task. */
  cursor: number;
  occurredAt: string;
};

export interface PhaseCounts {
  total: number;
  completed: number;
  error: number;
  skipped: number;
  finished: boolean;
}

export interface TaskSnapshot {
  taskId: string;
  /** The target without credentials. */
  url: string;
  status: TaskStatus;
  cursor: number;
  phase: PhaseId | null;
  phases: Partial<Record<PhaseId, PhaseCounts>>;
  /** The id of the most recently settled unit, for "Last checked" text. */
  lastWorkId: string | null;
  score: number | null;
  reasonCode: FailureReason | null;
  createdAt: string;
  updatedAt: string;
}

export function isTerminal(status: TaskStatus): boolean {
  return (
    status === TaskStatus.Succeeded ||
    status === TaskStatus.Failed ||
    status === TaskStatus.Cancelled
  );
}
