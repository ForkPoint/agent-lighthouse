import type { PhaseId } from "@forkpoint/agent-lighthouse-core";
import {
  isTerminal,
  TaskStatus,
  WorkOutcome,
  type PhaseCounts,
  type TaskEvent,
  type TaskSnapshot,
} from "./task-types";

export function initialSnapshot(
  taskId: string,
  url: string,
  now: string,
): TaskSnapshot {
  return {
    taskId,
    url,
    status: TaskStatus.Queued,
    cursor: 0,
    phase: null,
    phases: {},
    lastWorkId: null,
    score: null,
    reasonCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

const emptyCounts = (total: number): PhaseCounts => ({
  total,
  completed: 0,
  error: 0,
  skipped: 0,
  finished: false,
});

function withPhase(
  s: TaskSnapshot,
  phase: PhaseId,
  change: (c: PhaseCounts) => PhaseCounts,
): TaskSnapshot["phases"] {
  return { ...s.phases, [phase]: change(s.phases[phase] ?? emptyCounts(0)) };
}

/**
 * Folds one event into a snapshot. Pure. An event at or below the snapshot's
 * cursor returns the same object, so a repeated delivery changes nothing, and
 * a terminal snapshot only advances its cursor.
 */
export function applyTaskEvent(
  s: TaskSnapshot,
  event: TaskEvent,
): TaskSnapshot {
  if (event.cursor <= s.cursor) return s;
  const base = { ...s, cursor: event.cursor, updatedAt: event.occurredAt };
  if (isTerminal(s.status)) return base;
  switch (event.type) {
    case "task.queued":
      return { ...base, status: TaskStatus.Queued };
    case "task.started":
      return { ...base, status: TaskStatus.Running };
    case "phase.started":
      return {
        ...base,
        phase: event.phase,
        phases: { ...s.phases, [event.phase]: emptyCounts(event.total) },
      };
    case "phase.total_changed":
      return {
        ...base,
        phases: withPhase(s, event.phase, (c) => ({
          ...c,
          total: event.total,
        })),
      };
    case "work.settled": {
      const key =
        event.outcome === WorkOutcome.Completed
          ? "completed"
          : event.outcome === WorkOutcome.Error
            ? "error"
            : "skipped";
      return {
        ...base,
        lastWorkId: event.workId,
        phases: withPhase(s, event.phase, (c) => ({ ...c, [key]: c[key] + 1 })),
      };
    }
    case "phase.finished":
      return {
        ...base,
        phase: s.phase === event.phase ? null : s.phase,
        phases: withPhase(s, event.phase, (c) => ({ ...c, finished: true })),
      };
    case "task.succeeded":
      return {
        ...base,
        status: TaskStatus.Succeeded,
        phase: null,
        score: event.score,
      };
    case "task.failed":
      return {
        ...base,
        status: TaskStatus.Failed,
        phase: null,
        reasonCode: event.reasonCode,
      };
    case "task.cancelled":
      return { ...base, status: TaskStatus.Cancelled, phase: null };
    default:
      return assertNever(event);
  }
}

/** Compile-time exhaustiveness check for the event switch. */
function assertNever(value: never): never {
  throw new Error(`Unhandled task event: ${JSON.stringify(value)}`);
}
