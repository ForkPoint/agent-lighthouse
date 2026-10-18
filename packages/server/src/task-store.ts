import { randomUUID } from "node:crypto";
import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { applyTaskEvent, initialSnapshot } from "./reducer";
import { MAX_EVENTS_PER_TASK, MAX_TASKS, TERMINAL_TTL_MS } from "./limits";
import {
  isTerminal,
  type TaskEvent,
  type TaskEventBody,
  type TaskSnapshot,
} from "./task-types";

export type TaskListener = (event: TaskEvent, snapshot: TaskSnapshot) => void;

/**
 * Where task events and snapshots live. The in-memory store serves one
 * process; a database-backed store can implement the same interface. The
 * contract every implementation keeps: an append assigns the next cursor,
 * updates the snapshot and notifies subscribers as one step, so a reader
 * that takes a snapshot and subscribes in the same tick misses nothing.
 */
export interface TaskStore {
  /**
   * Undefined when every slot holds a live task. A store never holds more
   * than MAX_TASKS tasks.
   */
  create(url: string): TaskSnapshot | undefined;
  /** Undefined when the task is unknown or already terminal. */
  append(taskId: string, body: TaskEventBody): TaskEvent | undefined;
  /** Stores the report and appends `task.succeeded` in one step. */
  complete(taskId: string, report: ScanReport): TaskEvent | undefined;
  get(taskId: string): TaskSnapshot | undefined;
  /** `reset` is true when `cursor` is outside retained history. */
  eventsAfter(
    taskId: string,
    cursor: number,
  ): { events: TaskEvent[]; reset: boolean } | undefined;
  result(taskId: string): ScanReport | undefined;
  subscribe(taskId: string, listener: TaskListener): () => void;
}

interface Entry {
  snapshot: TaskSnapshot;
  events: TaskEvent[];
  listeners: Set<TaskListener>;
  result?: ScanReport;
  terminalAt?: number;
}

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, Entry>();
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(options: { now?: () => number; newId?: () => string } = {}) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? randomUUID;
  }

  create(url: string): TaskSnapshot | undefined {
    this.sweep();
    if (this.tasks.size >= MAX_TASKS) return undefined;
    const taskId = this.newId();
    const at = new Date(this.now()).toISOString();
    this.tasks.set(taskId, {
      snapshot: initialSnapshot(taskId, url, at),
      events: [],
      listeners: new Set(),
    });
    this.append(taskId, { type: "task.queued" });
    return this.tasks.get(taskId)!.snapshot;
  }

  append(taskId: string, body: TaskEventBody): TaskEvent | undefined {
    const entry = this.entry(taskId);
    if (!entry || isTerminal(entry.snapshot.status)) return undefined;
    const event: TaskEvent = {
      ...body,
      taskId,
      cursor: entry.snapshot.cursor + 1,
      occurredAt: new Date(this.now()).toISOString(),
    };
    entry.snapshot = applyTaskEvent(entry.snapshot, event);
    entry.events.push(event);
    if (entry.events.length > MAX_EVENTS_PER_TASK) entry.events.shift();
    if (isTerminal(entry.snapshot.status)) entry.terminalAt = this.now();
    for (const listener of entry.listeners) listener(event, entry.snapshot);
    return event;
  }

  complete(taskId: string, report: ScanReport): TaskEvent | undefined {
    const entry = this.entry(taskId);
    if (!entry || isTerminal(entry.snapshot.status)) return undefined;
    entry.result = report;
    return this.append(taskId, {
      type: "task.succeeded",
      score: report.overallScore,
    });
  }

  get(taskId: string): TaskSnapshot | undefined {
    return this.entry(taskId)?.snapshot;
  }

  eventsAfter(
    taskId: string,
    cursor: number,
  ): { events: TaskEvent[]; reset: boolean } | undefined {
    const entry = this.entry(taskId);
    if (!entry) return undefined;
    const first = entry.events[0]?.cursor ?? entry.snapshot.cursor + 1;
    if (cursor < first - 1 || cursor > entry.snapshot.cursor)
      return { events: [], reset: true };
    return {
      events: entry.events.filter((e) => e.cursor > cursor),
      reset: false,
    };
  }

  result(taskId: string): ScanReport | undefined {
    return this.entry(taskId)?.result;
  }

  subscribe(taskId: string, listener: TaskListener): () => void {
    const entry = this.entry(taskId);
    if (!entry) return () => {};
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }

  private expired(entry: Entry): boolean {
    return (
      entry.terminalAt !== undefined &&
      this.now() - entry.terminalAt > TERMINAL_TTL_MS
    );
  }

  /**
   * Every read goes through here, so an expired task is gone the moment its
   * window closes, not when the next task happens to be created.
   */
  private entry(taskId: string): Entry | undefined {
    const entry = this.tasks.get(taskId);
    if (entry && this.expired(entry)) {
      this.tasks.delete(taskId);
      return undefined;
    }
    return entry;
  }

  /** Drops expired terminal tasks, then the oldest terminal ones past the cap. */
  private sweep(): void {
    for (const [id, entry] of this.tasks)
      if (this.expired(entry)) this.tasks.delete(id);
    if (this.tasks.size < MAX_TASKS) return;
    // Map iteration is insertion order, so the first terminal entry is the oldest.
    for (const [id, entry] of this.tasks) {
      if (this.tasks.size < MAX_TASKS) break;
      if (entry.terminalAt !== undefined) this.tasks.delete(id);
    }
  }
}
