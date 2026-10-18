# SSE Task Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `@forkpoint/agent-lighthouse-server` package that runs scans as tasks and streams their progress to browsers over Server-Sent Events, started with `agent-lighthouse serve`.

**Architecture:** One Node process. `POST /tasks` starts a scan in the background and returns a task id. The scan's `ScanEvent`s and `AuditTrace` records become ordered `TaskEvent`s with a per-task `cursor`, kept in an in-memory `TaskStore` behind an interface. A pure reducer folds events into a `TaskSnapshot`. Every SSE frame carries the event **and** the snapshot it produced, so a client never runs a reducer, never replays history, and recovers from any disconnect by taking the first frame of the new stream. A JSON polling route serves the same data for clients that cannot stream.

**Tech Stack:** TypeScript 7, `node:http`, `node:crypto` `randomUUID`, tsup, vitest. No new runtime dependency.

## Global Constraints

- This ships in 9.0.0. Work on `feat/sse-task-server`, branched from `feat/v9-consumer-evidence`, in its own worktree at `../agent-lighthouse-sse`. Another session commits to `feat/v9-consumer-evidence`; never edit that checkout. When the plan is done, merge `feat/sse-task-server` into `feat/v9-consumer-evidence` so PR #168 carries it.
- Comments, JSDoc and inline config comments are English.
- oxlint is the only linter. Run lint as `rtk err pnpm lint`. Never run ESLint. Suppressions use `// oxlint-disable-*`.
- Enum values go through their constant (`TaskStatus.Running`, `PhaseId.Audits`), never a string literal. New string unions are const objects plus a type of the same name. Tagged-union `type` discriminants are exempt.
- Inside `packages/core/src`, import other core modules as `#core/<path>`. The server package imports core as `@forkpoint/agent-lighthouse-core`.
- Run vitest from the repo root only: `pnpm test -- <path>`. Use `AL_SKIP_NETWORK=1` for every test run in this plan.
- Never run `npx tsc -b`.
- Every target URL from a request passes `isSafeUrl()` from core before a scan starts.
- The server binds `127.0.0.1` by default. Port default `8787`.
- Limits, as named constants in `packages/server/src/limits.ts`: 4 running scans, 500 open streams, 100 retained tasks, 10,000 events per task, 60-minute retention after a terminal state, 15-second ping, 256 KiB send buffer per stream, 16 KiB request body.
- Before the final commit, all twelve checks from `CLAUDE.md` pass, in order.

## File Structure

| File | Responsibility |
| :--- | :--- |
| `packages/core/src/progress.ts` | Add the `phase:total` `ScanEvent`. |
| `packages/server/src/task-types.ts` | Enums, `TaskEvent`, `TaskSnapshot`. Types only, plus enum constants. |
| `packages/server/src/limits.ts` | Every numeric limit. |
| `packages/server/src/reducer.ts` | Pure `initialSnapshot` and `applyTaskEvent`. |
| `packages/server/src/task-store.ts` | `TaskStore` interface and `InMemoryTaskStore`. |
| `packages/server/src/scan-task.ts` | Runs one scan and translates its events into the store. |
| `packages/server/src/sse.ts` | Frame formatting and one open stream. |
| `packages/server/src/http.ts` | Route table, request parsing, limits. |
| `packages/server/src/page.ts` | The HTML page served at `GET /`. |
| `packages/server/src/index.ts` | Public exports and `startServer`. |
| `packages/cli/src/options.ts`, `packages/cli/src/main.ts` | The `serve` subcommand. |

---

### Task 1: Emit `phase:total` from core

`ProgressTracker.setPhaseTotal` changes the planned total without telling anyone. The server needs that number.

**Files:**
- Modify: `packages/core/src/progress.ts`
- Modify: `packages/mcp/src/progress.ts`
- Test: `packages/core/src/progress.test.ts`

**Interfaces:**
- Produces: new `ScanEvent` member `{ type: "phase:total"; phase: PhaseId; totalUnits: number; fraction: number; elapsedMs: number }`.

- [ ] **Step 1: Write the failing test** — append to `packages/core/src/progress.test.ts`:

```ts
describe("setPhaseTotal", () => {
  it("emits phase:total with the corrected total", () => {
    const events: ScanEvent[] = [];
    const tracker = new ProgressTracker((e) => events.push(e));
    tracker.phaseStart(PhaseId.FetchPages, 1);
    tracker.setPhaseTotal(3);
    expect(events.at(-1)).toMatchObject({
      type: "phase:total",
      phase: PhaseId.FetchPages,
      totalUnits: 3,
    });
  });

  it("never lowers the total below completed units", () => {
    const events: ScanEvent[] = [];
    const tracker = new ProgressTracker((e) => events.push(e));
    tracker.phaseStart(PhaseId.FetchPages, 3);
    tracker.unitDone();
    tracker.unitDone();
    tracker.setPhaseTotal(1);
    expect(events.at(-1)).toMatchObject({ type: "phase:total", totalUnits: 2 });
  });

  it("emits nothing outside a phase", () => {
    const events: ScanEvent[] = [];
    const tracker = new ProgressTracker((e) => events.push(e));
    tracker.setPhaseTotal(3);
    expect(events).toEqual([]);
  });
});
```

Add `ScanEvent` to the file's type import if it is not there.

- [ ] **Step 2: Run it and see it fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/core/src/progress.test.ts`
Expected: FAIL — the last event is `phase:start`, not `phase:total`.

- [ ] **Step 3: Implement** — in `packages/core/src/progress.ts`, add the union member after `phase:start`:

```ts
  | {
      type: "phase:total";
      phase: PhaseId;
      totalUnits: number;
      fraction: number;
      elapsedMs: number;
    }
```

Replace `setPhaseTotal`:

```ts
  /** Correct the current phase's unit total (e.g. a gateway page adds its target mid-phase). */
  setPhaseTotal(totalUnits: number): void {
    const phase = this.phase;
    if (phase === null) return;
    this.totalUnits = Math.max(this.completedUnits, totalUnits);
    this.onEvent({
      type: "phase:total",
      phase,
      totalUnits: this.totalUnits,
      ...this.stamp(),
    });
  }
```

In `packages/mcp/src/progress.ts`, add `case "phase:total":` to the group that falls through to `break` with `scan:start` and `unit:fail`. A total change moves no progress forward.

- [ ] **Step 4: Run the tests**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/core/src/progress.test.ts packages/mcp/src/progress.test.ts packages/cli/src/progress-renderer.test.ts`
Expected: PASS. If `progress-renderer.ts` has an exhaustive `switch` over `event.type`, add a `case "phase:total":` that does nothing, and run again.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/progress.ts packages/core/src/progress.test.ts packages/mcp/src/progress.ts packages/cli/src/progress-renderer.ts
git commit -m "feat(core): emit phase:total when a phase total changes"
```

---

### Task 2: Server package, task types and the reducer

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/tsconfig.build.json`, `packages/server/tsup.config.ts`, `packages/server/README.md`
- Create: `packages/server/src/task-types.ts`, `packages/server/src/limits.ts`, `packages/server/src/reducer.ts`, `packages/server/src/index.ts`
- Modify: `vitest.config.ts` (alias)
- Test: `packages/server/src/reducer.test.ts`

**Interfaces:**
- Consumes: `PhaseId`, `AuditOutcome`, `CheckStatus` from `@forkpoint/agent-lighthouse-core`.
- Produces:
  - `TaskStatus`, `WorkOutcome`, `FailureReason` (const objects + types)
  - `TaskEventBody`, `TaskEvent`, `PhaseCounts`, `TaskSnapshot`
  - `isTerminal(status: TaskStatus): boolean`
  - `initialSnapshot(taskId: string, url: string, now: string): TaskSnapshot`
  - `applyTaskEvent(snapshot: TaskSnapshot, event: TaskEvent): TaskSnapshot`

- [ ] **Step 1: Create the package files**

`packages/server/package.json`:

```json
{
  "name": "@forkpoint/agent-lighthouse-server",
  "version": "8.0.1",
  "description": "HTTP server that runs Agent Lighthouse scans as tasks and streams live progress over Server-Sent Events",
  "author": "ForkPoint",
  "license": "Apache-2.0",
  "homepage": "https://forkpoint.github.io/agent-lighthouse/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ForkPoint/agent-lighthouse.git",
    "directory": "packages/server"
  },
  "bugs": {
    "url": "https://github.com/ForkPoint/agent-lighthouse/issues"
  },
  "keywords": ["forkpoint", "agent-lighthouse", "server-sent-events", "sse", "agent-readiness"],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@forkpoint/agent-lighthouse-core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "tsup": "^8.3.5",
    "typescript": "~7.0.2"
  }
}
```

`packages/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

`packages/server/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "emitDeclarationOnly": true,
    "noEmitOnError": true,
    "declarationMap": false,
    "types": ["node"]
  },
  "exclude": ["src/**/*.test.ts"],
  "include": [],
  "files": ["src/index.ts"]
}
```

`packages/server/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["cjs", "esm"],
  // TypeScript 7 emits declarations after the JavaScript bundle.
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
});
```

`packages/server/README.md`:

```md
# @forkpoint/agent-lighthouse-server

Runs Agent Lighthouse scans as tasks and streams live progress over
Server-Sent Events.

    npx @forkpoint/agent-lighthouse serve --port 8787

See `docs/server.md` in the repository for the routes and the event format.
```

In `vitest.config.ts`, add to `test.alias` after the mcp entry:

```ts
      "@forkpoint/agent-lighthouse-server": resolve(
        __dirname,
        "packages/server/src/index.ts",
      ),
```

Run: `pnpm install`
Expected: the lockfile gains the `packages/server` importer. No new external package.

- [ ] **Step 2: Write the types and limits**

`packages/server/src/task-types.ts`:

```ts
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
```

`packages/server/src/limits.ts`:

```ts
/** Scans that may run at once. More are refused with 429. */
export const MAX_RUNNING_TASKS = 4;
/** Open SSE streams across all tasks. More are refused with 429. */
export const MAX_STREAMS = 500;
/** Tasks kept in memory. The oldest terminal task is dropped first. */
export const MAX_TASKS = 100;
/** Events kept per task for the polling route. Older ones are dropped. */
export const MAX_EVENTS_PER_TASK = 10_000;
/** How long a terminal task stays readable. */
export const TERMINAL_TTL_MS = 60 * 60 * 1000;
/** Comment frame interval. Shorter than nginx's 60 s and Cloudflare's 120 s read timeouts. */
export const PING_INTERVAL_MS = 15_000;
/** A stream whose unsent bytes pass this is closed; the client reconnects. */
export const MAX_STREAM_BUFFER_BYTES = 256 * 1024;
/** Largest accepted request body. */
export const MAX_BODY_BYTES = 16 * 1024;
/** Reconnect delay the browser uses after a dropped stream. */
export const SSE_RETRY_MS = 3000;
```

- [ ] **Step 3: Write the failing reducer test** — `packages/server/src/reducer.test.ts`:

```ts
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
  return bodies.map(ev).reduce(applyTaskEvent, initialSnapshot("t1", "https://shop.test/", T0));
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
      { type: "work.settled", phase: PhaseId.Audits, workId: "a/one", outcome: WorkOutcome.Completed, verdict: CheckStatus.Fail },
      { type: "work.settled", phase: PhaseId.Audits, workId: "a/two", outcome: WorkOutcome.Error, reasonCode: AuditOutcome.Error },
      { type: "work.settled", phase: PhaseId.Audits, workId: "a/three", outcome: WorkOutcome.Skipped, reasonCode: AuditOutcome.Gated },
    );
    expect(s.status).toBe(TaskStatus.Running);
    expect(s.phase).toBe(PhaseId.Audits);
    expect(s.phases[PhaseId.Audits]).toEqual({ total: 3, completed: 1, error: 1, skipped: 1, finished: false });
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
    const s = fold({ type: "task.started" }, { type: "task.succeeded", score: 72 });
    expect(s.status).toBe(TaskStatus.Succeeded);
    expect(s.score).toBe(72);
  });

  it("records a failure reason", () => {
    const s = fold({ type: "task.started" }, { type: "task.failed", reasonCode: FailureReason.ScanError });
    expect(s.status).toBe(TaskStatus.Failed);
    expect(s.reasonCode).toBe(FailureReason.ScanError);
  });

  it("ignores an event at or below the snapshot cursor", () => {
    const s = fold({ type: "task.queued" }, { type: "task.started" });
    const replay: TaskEvent = { type: "task.queued", taskId: "t1", cursor: 1, occurredAt: T0 };
    expect(applyTaskEvent(s, replay)).toBe(s);
  });

  it("never leaves a terminal state", () => {
    const s = fold({ type: "task.started" }, { type: "task.cancelled" });
    const late: TaskEvent = { type: "task.succeeded", score: 90, taskId: "t1", cursor: 3, occurredAt: T0 };
    expect(applyTaskEvent(s, late).status).toBe(TaskStatus.Cancelled);
  });
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/reducer.test.ts`
Expected: FAIL with `Failed to resolve import "./reducer"`.

- [ ] **Step 5: Implement** — `packages/server/src/reducer.ts`:

```ts
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
        phases: withPhase(s, event.phase, (c) => ({ ...c, total: event.total })),
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
      return { ...base, status: TaskStatus.Succeeded, phase: null, score: event.score };
    case "task.failed":
      return { ...base, status: TaskStatus.Failed, phase: null, reasonCode: event.reasonCode };
    case "task.cancelled":
      return { ...base, status: TaskStatus.Cancelled, phase: null };
  }
}
```

`packages/server/src/index.ts` (grows in later tasks):

```ts
export {
  TaskStatus,
  WorkOutcome,
  FailureReason,
  isTerminal,
} from "./task-types";
export type {
  TaskEvent,
  TaskEventBody,
  TaskSnapshot,
  PhaseCounts,
} from "./task-types";
export { applyTaskEvent, initialSnapshot } from "./reducer";
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/reducer.test.ts && pnpm --filter @forkpoint/agent-lighthouse-server typecheck`
Expected: 8 tests PASS. Typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/server vitest.config.ts pnpm-lock.yaml
git commit -m "feat(server): add task types and the snapshot reducer"
```

---

### Task 3: The in-memory task store

**Files:**
- Create: `packages/server/src/task-store.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/src/task-store.test.ts`

**Interfaces:**
- Consumes: `applyTaskEvent`, `initialSnapshot`, `isTerminal`, types from Task 2; limits.
- Produces:

```ts
export type TaskListener = (event: TaskEvent, snapshot: TaskSnapshot) => void;
export interface TaskStore {
  /** Undefined when all MAX_TASKS slots hold live tasks. */
  create(url: string): TaskSnapshot | undefined;
  append(taskId: string, body: TaskEventBody): TaskEvent | undefined;
  complete(taskId: string, report: ScanReport): TaskEvent | undefined;
  get(taskId: string): TaskSnapshot | undefined;
  eventsAfter(taskId: string, cursor: number): { events: TaskEvent[]; reset: boolean } | undefined;
  result(taskId: string): ScanReport | undefined;
  subscribe(taskId: string, listener: TaskListener): () => void;
}
export class InMemoryTaskStore implements TaskStore {
  constructor(options?: { now?: () => number; newId?: () => string });
}
```

- [ ] **Step 1: Write the failing test** — `packages/server/src/task-store.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore } from "./task-store";
import { MAX_EVENTS_PER_TASK, MAX_TASKS, TERMINAL_TTL_MS } from "./limits";
import { TaskStatus } from "./task-types";

const report = { overallScore: 81 } as unknown as ScanReport;

function makeStore(start = 0) {
  let now = start;
  let n = 0;
  const store = new InMemoryTaskStore({ now: () => now, newId: () => `t${++n}` });
  return { store, advance: (ms: number) => (now += ms) };
}

describe("InMemoryTaskStore", () => {
  it("creates a queued task at cursor 1", () => {
    const { store } = makeStore();
    const s = store.create("https://shop.test/");
    expect(s).toMatchObject({ taskId: "t1", status: TaskStatus.Queued, cursor: 1 });
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

  it("stores the result in the same step as task.succeeded", () => {
    const { store } = makeStore();
    store.create("https://shop.test/");
    const listener = vi.fn();
    store.subscribe("t1", listener);
    store.complete("t1", report);
    expect(listener).toHaveBeenCalledOnce();
    // The listener ran after the result was readable.
    expect(store.result("t1")).toBe(report);
    expect(store.get("t1")).toMatchObject({ status: TaskStatus.Succeeded, score: 81 });
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/task-store.test.ts`
Expected: FAIL with `Failed to resolve import "./task-store"`.

- [ ] **Step 3: Implement** — `packages/server/src/task-store.ts`:

```ts
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
```

Note `report.overallScore` is `number | null` in `ScanReport`. If the field name differs, read `packages/core/src/contracts.ts:471` and use the real one; fix the test fixture to match.

Add to `packages/server/src/index.ts`:

```ts
export { InMemoryTaskStore } from "./task-store";
export type { TaskStore, TaskListener } from "./task-store";
```

- [ ] **Step 4: Run the tests**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/task-store.test.ts`
Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/task-store.ts packages/server/src/task-store.test.ts packages/server/src/index.ts
git commit -m "feat(server): add the in-memory task store"
```

---

### Task 4: Run a scan as a task

**Files:**
- Create: `packages/server/src/scan-task.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/src/scan-task.test.ts`

**Interfaces:**
- Consumes: `runScan`, `ScanEvent`, `AuditTrace`, `AuditOutcome`, `PhaseId`, `ScanReport` from core; `TaskStore` from Task 3.
- Produces:

```ts
export function scanEventToBody(event: ScanEvent): TaskEventBody | undefined;
export function traceToBody(trace: AuditTrace): TaskEventBody;
export interface RunningTask { cancel(): void; done: Promise<void> }
export function startScanTask(store: TaskStore, taskId: string, url: string, scan?: typeof runScan): RunningTask;
```

Mapping rules, written once here:
- `phase:start` becomes `phase.started`. `phase:total` becomes `phase.total_changed`. `phase:done` becomes `phase.finished`.
- Outside the audits phase, `unit:done` becomes `work.settled` `completed`, and `unit:fail` becomes `work.settled` `error`. `workId` is the event's `label`, or `"unit"` when it has none.
- Inside the audits phase, `unit:*` events are dropped. Every audit, run or not, produces one `AuditTrace` (`packages/core/src/audit-runner.ts` calls `trace()` for skipped, budget and run audits). Each trace becomes `work.settled` with `workId = trace.id`: `ran` is `completed` with `verdict = trace.status`, `error` is `error`, and `skipped`, `gated` and `budget` are `skipped`. `reasonCode` is always `trace.outcome`.
- `scan:start` and `scan:done` are dropped. `task.started` comes from the runner, and success comes only from `store.complete` after `runScan` returns.

- [ ] **Step 1: Write the failing test** — `packages/server/src/scan-task.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  AuditOutcome,
  CheckStatus,
  PhaseId,
  type AuditTrace,
  type ScanOptions,
  type ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore } from "./task-store";
import { scanEventToBody, startScanTask, traceToBody } from "./scan-task";
import { FailureReason, TaskStatus, WorkOutcome } from "./task-types";

const trace = (id: string, outcome: AuditOutcome, status = CheckStatus.Pass) =>
  ({ id, outcome, status }) as AuditTrace;
const stamp = { fraction: 0, elapsedMs: 0 };

describe("scanEventToBody", () => {
  it("maps phase events", () => {
    expect(scanEventToBody({ type: "phase:start", phase: PhaseId.FetchPages, totalUnits: 2, ...stamp }))
      .toEqual({ type: "phase.started", phase: PhaseId.FetchPages, total: 2 });
    expect(scanEventToBody({ type: "phase:total", phase: PhaseId.FetchPages, totalUnits: 3, ...stamp }))
      .toEqual({ type: "phase.total_changed", phase: PhaseId.FetchPages, total: 3 });
    expect(scanEventToBody({ type: "phase:done", phase: PhaseId.FetchPages, durationMs: 5, ...stamp }))
      .toEqual({ type: "phase.finished", phase: PhaseId.FetchPages });
  });

  it("maps fetch units", () => {
    expect(scanEventToBody({ type: "unit:fail", phase: PhaseId.Analyze, label: "/p", error: "boom", ...stamp }))
      .toEqual({ type: "work.settled", phase: PhaseId.Analyze, workId: "/p", outcome: WorkOutcome.Error });
  });

  it("drops audit units and scan bookends", () => {
    expect(scanEventToBody({ type: "unit:done", phase: PhaseId.Audits, completed: 1, total: 2, label: "x", ...stamp })).toBeUndefined();
    expect(scanEventToBody({ type: "scan:start", url: "https://shop.test/", ...stamp })).toBeUndefined();
    expect(scanEventToBody({ type: "scan:done", durationMs: 1, score: 5, ...stamp })).toBeUndefined();
  });
});

describe("traceToBody", () => {
  it("keeps a failing verdict as completed work", () => {
    expect(traceToBody(trace("a/x", AuditOutcome.Ran, CheckStatus.Fail))).toEqual({
      type: "work.settled", phase: PhaseId.Audits, workId: "a/x",
      outcome: WorkOutcome.Completed, reasonCode: AuditOutcome.Ran, verdict: CheckStatus.Fail,
    });
  });

  it.each([AuditOutcome.Skipped, AuditOutcome.Gated, AuditOutcome.Budget])("maps %s to skipped", (o) => {
    expect(traceToBody(trace("a/x", o))).toMatchObject({ outcome: WorkOutcome.Skipped, reasonCode: o });
  });

  it("maps error to error", () => {
    expect(traceToBody(trace("a/x", AuditOutcome.Error))).toMatchObject({ outcome: WorkOutcome.Error });
  });
});

describe("startScanTask", () => {
  it("streams progress and completes with the report", async () => {
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn(async (_url: string, o?: ScanOptions) => {
      o?.onEvent?.({ type: "phase:start", phase: PhaseId.Audits, totalUnits: 1, ...stamp });
      o?.onAuditTrace?.(trace("a/x", AuditOutcome.Ran));
      o?.onEvent?.({ type: "phase:done", phase: PhaseId.Audits, durationMs: 1, ...stamp });
      return { overallScore: 64 } as unknown as ScanReport;
    });
    await startScanTask(store, taskId, "https://shop.test/", scan).done;
    expect(store.get(taskId)).toMatchObject({ status: TaskStatus.Succeeded, score: 64 });
    expect(store.get(taskId)?.phases[PhaseId.Audits]).toMatchObject({ total: 1, completed: 1, finished: true });
    expect(store.result(taskId)).toBeDefined();
  });

  it("fails with a safe reason code and no raw error text", async () => {
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn(async () => { throw new Error("secret stack detail"); });
    await startScanTask(store, taskId, "https://shop.test/", scan).done;
    expect(store.get(taskId)).toMatchObject({ status: TaskStatus.Failed, reasonCode: FailureReason.ScanError });
    expect(JSON.stringify(store.eventsAfter(taskId, 0))).not.toContain("secret");
  });

  it("cancels through the abort signal", async () => {
    const store = new InMemoryTaskStore();
    const { taskId } = store.create("https://shop.test/")!;
    const scan = vi.fn((_url: string, o?: ScanOptions) =>
      new Promise<ScanReport>((_, reject) =>
        o?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
    );
    const task = startScanTask(store, taskId, "https://shop.test/", scan);
    task.cancel();
    await task.done;
    expect(store.get(taskId)?.status).toBe(TaskStatus.Cancelled);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/scan-task.test.ts`
Expected: FAIL with `Failed to resolve import "./scan-task"`.

- [ ] **Step 3: Implement** — `packages/server/src/scan-task.ts`:

```ts
import {
  AuditOutcome,
  logger,
  PhaseId,
  runScan,
  type AuditTrace,
  type ScanEvent,
} from "@forkpoint/agent-lighthouse-core";
import type { TaskStore } from "./task-store";
import {
  FailureReason,
  WorkOutcome,
  type TaskEventBody,
} from "./task-types";

/**
 * One scan event as a task event, or undefined when the task stream does not
 * carry it. Audit units are dropped because each audit's AuditTrace says more:
 * whether it ran, was skipped, gated or cut by the budget, and its verdict.
 */
export function scanEventToBody(event: ScanEvent): TaskEventBody | undefined {
  switch (event.type) {
    case "phase:start":
      return { type: "phase.started", phase: event.phase, total: event.totalUnits };
    case "phase:total":
      return { type: "phase.total_changed", phase: event.phase, total: event.totalUnits };
    case "phase:done":
      return { type: "phase.finished", phase: event.phase };
    case "unit:done":
    case "unit:fail":
      if (event.phase === PhaseId.Audits) return undefined;
      return {
        type: "work.settled",
        phase: event.phase,
        workId: event.label ?? "unit",
        outcome: event.type === "unit:done" ? WorkOutcome.Completed : WorkOutcome.Error,
      };
    case "scan:start":
    case "scan:done":
      return undefined;
  }
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
  const done = scan(url, {
    signal: controller.signal,
    onEvent: (event) => {
      const body = scanEventToBody(event);
      if (body) store.append(taskId, body);
    },
    onAuditTrace: (trace) => store.append(taskId, traceToBody(trace)),
  }).then(
    (report) => {
      store.complete(taskId, report);
    },
    (error: unknown) => {
      if (controller.signal.aborted) {
        store.append(taskId, { type: "task.cancelled" });
        return;
      }
      // The raw error stays in the server log; the task carries a code.
      logger.error({ taskId, err: error }, "Scan task failed");
      store.append(taskId, { type: "task.failed", reasonCode: FailureReason.ScanError });
    },
  );
  return { cancel: () => controller.abort(), done };
}
```

Check the logger export before running: `grep -n "logger" packages/core/src/index.ts`. If core exports a factory instead of an instance, use the same call `packages/cli/src/main.ts` uses.

Add to `packages/server/src/index.ts`:

```ts
export { startScanTask, scanEventToBody, traceToBody } from "./scan-task";
export type { RunningTask } from "./scan-task";
```

- [ ] **Step 4: Run the tests**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/scan-task.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/scan-task.ts packages/server/src/scan-task.test.ts packages/server/src/index.ts
git commit -m "feat(server): run a scan as a task and map its events"
```

---

### Task 5: SSE stream and HTTP routes

**Files:**
- Create: `packages/server/src/sse.ts`, `packages/server/src/http.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/src/sse.test.ts`, `packages/server/src/http.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4; `isSafeUrl` from core.
- Produces:

```ts
// sse.ts
export function sseFrame(event: string, id: number, data: unknown): string;
export function openTaskStream(store: TaskStore, taskId: string, res: ServerResponse, onClose: () => void): void;
// http.ts
export interface TaskServerOptions { store?: TaskStore; token?: string; scan?: typeof runScan; page?: string }
export interface TaskServer { handle(req: IncomingMessage, res: ServerResponse): void; close(): void }
export function createTaskServer(options?: TaskServerOptions): TaskServer;
```

Routes:

| Method and path | Answer |
| :--- | :--- |
| `GET /` | The HTML page (Task 6). |
| `POST /tasks` | Body `{"url": "..."}`. `202 {"taskId", "snapshot"}`. `400` bad body or URL, `422` unsafe target, `429` when `MAX_RUNNING_TASKS` scan promises are unsettled (a cancelled scan counts until it settles) or the store has no free slot, `401` bad token. |
| `GET /tasks/:id` | `200` snapshot, `404` unknown. |
| `GET /tasks/:id/stream` | SSE. First frame `snapshot`. Then one `progress` frame per event: `{"event", "snapshot"}`, `id` = cursor. Ends after a terminal frame. `429` over `MAX_STREAMS`. |
| `GET /tasks/:id/updates?after=N` | `200 {"events", "snapshot", "reset"}`. The polling fallback. |
| `GET /tasks/:id/result` | `200` the `ScanReport`, `409` not succeeded, `404` unknown. |
| `DELETE /tasks/:id` | `202` cancel requested, `404` unknown, `401` bad token. |

Rules:
- The token, when set, guards `POST` and `DELETE` only, as `Authorization: Bearer <token>`. Reads go by task id, a random UUID. `EventSource` cannot send headers, and a token in a URL leaks into logs.
- A reconnect needs no replay. Every frame carries the whole snapshot, so the first frame of a new stream is the current state. The browser still sends `Last-Event-ID`; the server ignores it.
- The snapshot read and the subscribe happen in the same synchronous block. Node runs one tick at a time, so no event falls between them.
- Headers: `content-type: text/event-stream; charset=utf-8`, `cache-control: no-cache, no-transform`, `connection: keep-alive`, `x-accel-buffering: no`. No compression.

- [ ] **Step 1: Write the failing SSE test** — `packages/server/src/sse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sseFrame } from "./sse";

describe("sseFrame", () => {
  it("writes id, event and one data line", () => {
    expect(sseFrame("progress", 7, { a: 1 })).toBe('id: 7\nevent: progress\ndata: {"a":1}\n\n');
  });

  it("never lets a newline inside data split the frame", () => {
    expect(sseFrame("progress", 1, { s: "a\nb" })).toBe('id: 1\nevent: progress\ndata: {"s":"a\\nb"}\n\n');
  });
});
```

- [ ] **Step 2: Write the failing HTTP test** — `packages/server/src/http.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  PhaseId,
  type ScanOptions,
  type ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { createTaskServer, type TaskServer } from "./http";
import { TaskStatus } from "./task-types";

vi.mock("@forkpoint/agent-lighthouse-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@forkpoint/agent-lighthouse-core")>()),
  isSafeUrl: vi.fn(async (url: string) => !url.includes("127.0.0.1")),
}));

const stamp = { fraction: 0, elapsedMs: 0 };
// Each mock scan waits until release() settles every pending scan. The scans
// ignore their abort signal on purpose, like a scan stuck in a slow request.
const pending: (() => void)[] = [];
const release = () => pending.splice(0).forEach((resolve) => resolve());
const scan = vi.fn((_url: string, o?: ScanOptions) => {
  o?.onEvent?.({ type: "phase:start", phase: PhaseId.FetchRoot, totalUnits: 1, ...stamp });
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
  await new Promise((r) => http.close(r));
});

const post = (body: unknown, token = "s3cret") =>
  fetch(`${base}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

/** Reads SSE frames until `stop` returns true. */
async function readFrames(res: Response, stop: (f: { event: string; data: any }[]) => boolean) {
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
    expect((await post({ url: "https://shop.test/" }, "wrong")).status).toBe(401);
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
    const frames = await readFrames(res, (f) => f.at(-1)?.data.snapshot?.status === TaskStatus.Succeeded);
    expect(frames[0]!.event).toBe("snapshot");
    expect(frames.at(-1)!.event).toBe("progress");
    expect(frames.at(-1)!.data.event.type).toBe("task.succeeded");
    const cursors = frames.slice(1).map((f) => f.data.event.cursor);
    expect(cursors).toEqual([...cursors].sort((a, b) => a - b));
    expect((await fetch(`${base}/tasks/${taskId}/result`)).status).toBe(200);
  });

  it("serves the same state to a poller", async () => {
    const { taskId } = await (await post({ url: "https://shop.test/" })).json();
    const body = await (await fetch(`${base}/tasks/${taskId}/updates?after=1`)).json();
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
    const del = await fetch(`${base}/tasks/${taskId}`, { method: "DELETE", headers: { authorization: "Bearer s3cret" } });
    expect(del.status).toBe(202);
    // The mock scan ignores the signal, so cancel is recorded by the server itself.
    const snap = await (await fetch(`${base}/tasks/${taskId}`)).json();
    expect(snap.status).toBe(TaskStatus.Cancelled);
  });

  it("keeps a cancelled scan's slot until its promise settles", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++)
      ids.push((await (await post({ url: `https://s${i}.test/` })).json()).taskId);
    await fetch(`${base}/tasks/${ids[0]}`, { method: "DELETE", headers: { authorization: "Bearer s3cret" } });
    expect((await post({ url: "https://five.test/" })).status).toBe(429);
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect((await post({ url: "https://five.test/" })).status).toBe(202);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/sse.test.ts packages/server/src/http.test.ts`
Expected: FAIL with `Failed to resolve import "./sse"` and `"./http"`.

- [ ] **Step 4: Implement `sse.ts`**

```ts
import type { ServerResponse } from "node:http";
import type { TaskStore } from "./task-store";
import {
  MAX_STREAM_BUFFER_BYTES,
  PING_INTERVAL_MS,
  SSE_RETRY_MS,
} from "./limits";
import { isTerminal } from "./task-types";

/** One SSE frame. JSON.stringify escapes newlines, so `data` stays one line. */
export function sseFrame(event: string, id: number, data: unknown): string {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Streams one task. The first frame is the current snapshot; each later frame
 * carries an event and the snapshot it produced, so a client that reconnects
 * is current after one frame and never replays history. Reading the snapshot
 * and subscribing happen in one synchronous block, so no event falls between.
 */
export function openTaskStream(
  store: TaskStore,
  taskId: string,
  res: ServerResponse,
  onClose: () => void,
): void {
  const snapshot = store.get(taskId)!;
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    // nginx buffers proxied responses unless told not to.
    "x-accel-buffering": "no",
  });
  res.write(`retry: ${SSE_RETRY_MS}\n\n`);
  res.write(sseFrame("snapshot", snapshot.cursor, snapshot));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    unsubscribe();
    res.end();
    onClose();
  };
  const send = (chunk: string) => {
    res.write(chunk);
    // A reader that stopped draining is dropped; it recovers on reconnect.
    if (res.writableLength > MAX_STREAM_BUFFER_BYTES) {
      res.destroy();
      close();
    }
  };

  const unsubscribe = store.subscribe(taskId, (event, next) => {
    send(sseFrame("progress", event.cursor, { event, snapshot: next }));
    if (isTerminal(next.status)) close();
  });
  const ping = setInterval(() => send(": ping\n\n"), PING_INTERVAL_MS);
  res.on("close", close);
  if (isTerminal(snapshot.status)) close();
}
```

- [ ] **Step 5: Implement `http.ts`**

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isSafeUrl,
  runScan,
} from "@forkpoint/agent-lighthouse-core";
import { InMemoryTaskStore, type TaskStore } from "./task-store";
import { startScanTask, type RunningTask } from "./scan-task";
import { openTaskStream } from "./sse";
import { MAX_BODY_BYTES, MAX_RUNNING_TASKS, MAX_STREAMS } from "./limits";
import { FailureReason, TaskStatus } from "./task-types";
import { PAGE_HTML } from "./page";

export interface TaskServerOptions {
  store?: TaskStore;
  /** When set, POST and DELETE need `Authorization: Bearer <token>`. */
  token?: string;
  scan?: typeof runScan;
  page?: string;
}

export interface TaskServer {
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Cancels running scans. Call before closing the HTTP server. */
  close(): void;
}

const TASK_PATH = /^\/tasks\/([^/]+)(\/stream|\/updates|\/result)?$/;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** The target as a task shows it: without a `user:password@` part. */
function publicUrl(url: URL): string {
  const copy = new URL(url);
  copy.username = "";
  copy.password = "";
  return copy.href;
}

export function createTaskServer(options: TaskServerOptions = {}): TaskServer {
  const store = options.store ?? new InMemoryTaskStore();
  const scan = options.scan ?? runScan;
  const page = options.page ?? PAGE_HTML;
  const running = new Map<string, RunningTask>();
  let streams = 0;

  const authorized = (req: IncomingMessage) =>
    options.token === undefined ||
    req.headers.authorization === `Bearer ${options.token}`;

  async function create(req: IncomingMessage, res: ServerResponse) {
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    let target: URL;
    try {
      const body = (await readJson(req)) as { url?: unknown };
      if (typeof body.url !== "string") throw new Error("no url");
      target = new URL(body.url);
    } catch {
      return json(res, 400, { error: "invalid_request" });
    }
    if (!(await isSafeUrl(target.href)))
      return json(res, 422, { error: FailureReason.UnsafeTarget });
    // Counts scan promises, not task status: a cancelled task is terminal at
    // once, but its scan holds a slot until the promise settles.
    if (running.size >= MAX_RUNNING_TASKS)
      return json(res, 429, { error: "too_many_tasks" });
    const snapshot = store.create(publicUrl(target));
    if (!snapshot) return json(res, 429, { error: "too_many_tasks" });
    const task = startScanTask(store, snapshot.taskId, target.href, scan);
    running.set(snapshot.taskId, task);
    void task.done.then(() => running.delete(snapshot.taskId));
    json(res, 202, { taskId: snapshot.taskId, snapshot: store.get(snapshot.taskId) });
  }

  function route(req: IncomingMessage, res: ServerResponse): void | Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    if (req.method === "POST" && url.pathname === "/tasks") return create(req, res);

    const match = TASK_PATH.exec(url.pathname);
    if (!match) return json(res, 404, { error: "not_found" });
    const [, taskId, sub] = match as unknown as [string, string, string | undefined];
    const snapshot = store.get(taskId);
    if (!snapshot) return json(res, 404, { error: "not_found" });

    if (req.method === "DELETE" && sub === undefined) {
      if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
      running.get(taskId)?.cancel();
      // A scan that ignores its signal still ends as cancelled for viewers.
      store.append(taskId, { type: "task.cancelled" });
      return json(res, 202, { snapshot: store.get(taskId) });
    }
    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });

    switch (sub) {
      case undefined:
        return json(res, 200, snapshot);
      case "/stream":
        if (streams >= MAX_STREAMS) return json(res, 429, { error: "too_many_streams" });
        streams++;
        return openTaskStream(store, taskId, res, () => streams--);
      case "/updates": {
        const after = Number(url.searchParams.get("after") ?? "0");
        const batch = store.eventsAfter(taskId, Number.isInteger(after) ? after : -1)!;
        return json(res, 200, { ...batch, snapshot: store.get(taskId) });
      }
      case "/result": {
        const result = store.result(taskId);
        if (snapshot.status !== TaskStatus.Succeeded || !result)
          return json(res, 409, { error: "not_ready", status: snapshot.status });
        return json(res, 200, result);
      }
    }
  }

  return {
    handle(req, res) {
      Promise.resolve(route(req, res)).catch(() => {
        if (!res.headersSent) json(res, 500, { error: "internal" });
        else res.destroy();
      });
    },
    close() {
      for (const [taskId, task] of running) {
        task.cancel();
        store.append(taskId, { type: "task.failed", reasonCode: FailureReason.Shutdown });
      }
    },
  };
}
```

`page.ts` does not exist yet. Create a stub now so the import resolves; Task 6 fills it:

```ts
export const PAGE_HTML = "<!doctype html><title>Agent Lighthouse</title>";
```

Add to `packages/server/src/index.ts`:

```ts
export { createTaskServer } from "./http";
export type { TaskServer, TaskServerOptions } from "./http";
```

- [ ] **Step 6: Run the tests**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/sse.test.ts packages/server/src/http.test.ts`
Expected: all PASS. If the stream test hangs, the frame parser in the test never saw `\n\n`; check `sseFrame` output first.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src
git commit -m "feat(server): add SSE stream and task routes"
```

---

### Task 6: The live progress page and `startServer`

**Files:**
- Modify: `packages/server/src/page.ts`
- Create: `packages/server/src/start.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/src/start.test.ts`

**Interfaces:**
- Produces:

```ts
export interface StartServerOptions { port?: number; host?: string; token?: string }
export function startServer(options?: StartServerOptions): Promise<{ url: string; close(): Promise<void> }>;
```

Page rules (from the design review): show phase name and exact counts, never a percent and never a time estimate. "Total unknown" never appears because every phase starts with a total. A failing verdict counts as completed. On a stream error, keep the last snapshot and show "Updates disconnected"; `EventSource` reconnects on its own. Without `EventSource`, poll `/updates` every 3 seconds.

- [ ] **Step 1: Write the failing test** — `packages/server/src/start.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { startServer } from "./start";

describe("startServer", () => {
  it("listens on loopback and serves the page", async () => {
    const server = await startServer({ port: 0 });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const html = await (await fetch(server.url)).text();
      expect(html).toContain("new EventSource");
      expect(html).toContain("/updates?after=");
      expect(html).not.toMatch(/ETA|remaining/i);
      // One watcher at a time: a new submission stops the old one.
      expect(html).toContain("stopWatch();");
      expect(html).toContain("if (s.taskId !== current) return;");
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server/src/start.test.ts`
Expected: FAIL with `Failed to resolve import "./start"`.

- [ ] **Step 3: Implement `start.ts`**

```ts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createTaskServer } from "./http";

export interface StartServerOptions {
  port?: number;
  host?: string;
  token?: string;
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<{ url: string; close(): Promise<void> }> {
  const tasks = createTaskServer(
    options.token === undefined ? {} : { token: options.token },
  );
  const http = createServer((req, res) => tasks.handle(req, res));
  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port ?? 8787, host, resolve);
  });
  const { port } = http.address() as AddressInfo;
  const shown = host.includes(":") ? `[${host}]` : host;
  return {
    url: `http://${shown}:${port}/`,
    close: () =>
      new Promise((resolve) => {
        tasks.close();
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}
```

- [ ] **Step 4: Implement the page** — replace `packages/server/src/page.ts`:

```ts
/**
 * The page served at `/`. Plain HTML and one inline script, no build step.
 * It renders the snapshot each frame carries, so it holds no reducer.
 */
export const PAGE_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Lighthouse</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7fb; --fg: #1d2433; --muted: #5b6475; --line: #d9dee8; }
  @media (prefers-color-scheme: dark) { :root { --bg: #11141a; --fg: #e6e9ef; --muted: #9aa3b2; --line: #2a303b; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 720px; margin: auto; padding: 32px 16px; }
  form { display: flex; gap: 8px; flex-wrap: wrap; }
  input { flex: 1 1 240px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; }
  button { padding: 8px 16px; border-radius: 6px; border: 0; background: #4f46e5; color: #fff; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--line); }
  .muted { color: var(--muted); }
</style>
<main>
  <h1>Agent Lighthouse</h1>
  <form id="f">
    <input id="url" type="url" required placeholder="https://example.com">
    <input id="token" type="password" placeholder="Token (if the server needs one)">
    <button>Scan</button>
  </form>
  <p id="status" class="muted">Enter a URL to start a scan.</p>
  <p id="conn" class="muted"></p>
  <table id="phases" hidden>
    <thead><tr><th>Phase</th><th>Done</th><th>Errors</th><th>Skipped</th><th>Total</th></tr></thead>
    <tbody></tbody>
  </table>
  <p id="result"></p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const LABEL = { queued: "Waiting to start.", running: "Running.", succeeded: "Finished.", failed: "Failed.", cancelled: "Cancelled." };
// One watched task at a time. A new submission stops the old stream or poll
// loop, and render drops any frame for another task that is still in flight.
let current = null;
let last = null;
let stopWatch = () => {};
let submission = 0;

function render(s) {
  if (s.taskId !== current) return;
  if (last && s.cursor < last.cursor) return;
  last = s;
  $("status").textContent = LABEL[s.status] + (s.lastWorkId ? " Last checked: " + s.lastWorkId : "");
  const rows = Object.entries(s.phases).map(([id, c]) =>
    "<tr><td>" + id + (c.finished ? "" : " …") + "</td><td>" + c.completed + "</td><td>" + c.error +
    "</td><td>" + c.skipped + "</td><td>" + c.total + "</td></tr>");
  $("phases").hidden = rows.length === 0;
  $("phases").tBodies[0].innerHTML = rows.join("");
  if (s.status === "succeeded")
    $("result").innerHTML = "Score: " + (s.score ?? "not assessed") + ' · <a href="tasks/' + s.taskId + '/result">JSON report</a>';
  if (s.status === "failed") $("result").textContent = "Reason: " + s.reasonCode;
}

function terminal(s) { return s.status === "succeeded" || s.status === "failed" || s.status === "cancelled"; }

function watch(taskId) {
  if (!("EventSource" in window)) {
    let active = true;
    stopWatch = () => { active = false; };
    return poll(taskId, () => active);
  }
  const es = new EventSource("tasks/" + taskId + "/stream");
  stopWatch = () => es.close();
  es.addEventListener("snapshot", (e) => { $("conn").textContent = ""; render(JSON.parse(e.data)); });
  es.addEventListener("progress", (e) => {
    const { snapshot } = JSON.parse(e.data);
    render(snapshot);
    if (terminal(snapshot)) es.close();
  });
  es.onerror = () => {
    if (last && terminal(last)) return es.close();
    $("conn").textContent = "Updates disconnected. Last update " + (last ? new Date(last.updatedAt).toLocaleTimeString() : "never") + ". Reconnecting.";
  };
}

async function poll(taskId, active) {
  while (active()) {
    try {
      const r = await fetch("tasks/" + taskId + "/updates?after=" + (last ? last.cursor : 0));
      const body = await r.json();
      if (!active()) return;
      render(body.snapshot);
      $("conn").textContent = "";
      if (terminal(body.snapshot)) return;
    } catch { $("conn").textContent = "Updates disconnected. Retrying."; }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  stopWatch();
  stopWatch = () => {};
  current = null;
  last = null;
  const mine = ++submission;
  $("result").textContent = "";
  $("conn").textContent = "";
  $("phases").hidden = true;
  const headers = { "content-type": "application/json" };
  if ($("token").value) headers.authorization = "Bearer " + $("token").value;
  const r = await fetch("tasks", { method: "POST", headers, body: JSON.stringify({ url: $("url").value }) });
  const body = await r.json();
  // A later submission won while this request was in flight.
  if (mine !== submission) return;
  if (!r.ok) { $("status").textContent = "Could not start: " + body.error; return; }
  current = body.taskId;
  render(body.snapshot);
  watch(body.taskId);
});
</script>
</html>`;
```

Add to `packages/server/src/index.ts`:

```ts
export { startServer } from "./start";
export type { StartServerOptions } from "./start";
```

- [ ] **Step 5: Run the tests**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/server`
Expected: all server tests PASS.

- [ ] **Step 6: Check the page by hand**

Run: `pnpm --filter @forkpoint/agent-lighthouse-core build && node --import tsx -e "import('./packages/server/src/start.ts').then(m => m.startServer()).then(s => console.log(s.url))"`
Open `http://127.0.0.1:8787/`, scan `https://example.com`, and confirm: phase rows fill in, counts only go up, the page ends with a score and a working JSON link. Then start a scan of `https://example.com`, and before it ends start a second scan of `https://example.org`: the rows reset, only the second task's frames render, and the DevTools Network tab shows the first `/stream` request closed. Stop the process with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src
git commit -m "feat(server): add the live progress page and startServer"
```

---

### Task 7: `agent-lighthouse serve`

**Files:**
- Modify: `packages/cli/src/options.ts` (`CliCommand`, `resolveCommand`, new `parseServeOptions`)
- Modify: `packages/cli/src/main.ts` (dispatch, usage text)
- Modify: `packages/cli/package.json` (dependency)
- Test: `packages/cli/src/options.test.ts`

**Interfaces:**
- Consumes: `startServer` from `@forkpoint/agent-lighthouse-server`.
- Produces: `CliCommand.Serve = "serve"`; `parseServeOptions(args: string[], env?: NodeJS.ProcessEnv): { port: number; host: string; token?: string }`.

- [ ] **Step 1: Write the failing tests** — append to `packages/cli/src/options.test.ts`, and add `parseServeOptions` to its import from `./options`:

```ts
describe("serve", () => {
  it("resolves the serve subcommand", () => {
    expect(resolveCommand(["serve"])).toEqual({ action: CliCommand.Serve });
    expect(resolveCommand(["serve", "--port", "9000"])).toEqual({ action: CliCommand.Serve });
  });

  it("defaults to loopback and port 8787", () => {
    expect(parseServeOptions(["serve"], {})).toEqual({ port: 8787, host: "127.0.0.1" });
  });

  it("reads flags and the token from the environment", () => {
    expect(
      parseServeOptions(["serve", "--port", "9000", "--host", "0.0.0.0"], { AL_SERVER_TOKEN: "t" }),
    ).toEqual({ port: 9000, host: "0.0.0.0", token: "t" });
  });

  it("prefers --token over the environment", () => {
    expect(parseServeOptions(["serve", "--token", "a"], { AL_SERVER_TOKEN: "b" }).token).toBe("a");
  });

  it("rejects a bad port", () => {
    expect(() => parseServeOptions(["serve", "--port", "70000"], {})).toThrow(/port/);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/cli/src/options.test.ts`
Expected: FAIL — `CliCommand.Serve` is undefined and `parseServeOptions` is not exported.

- [ ] **Step 3: Implement in `options.ts`**

Add `Serve: "serve",` to `CliCommand`. At the top of `resolveCommand`, after the help check:

```ts
  if (args[0] === "serve") return { action: CliCommand.Serve };
```

Add after `resolveCommand`:

```ts
/** Flags of `agent-lighthouse serve`. The token may come from `AL_SERVER_TOKEN`. */
export function parseServeOptions(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): { port: number; host: string; token?: string } {
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const rawPort = value("--port") ?? "8787";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65_535)
    throw new Error(`Invalid --port: ${rawPort}`);
  const token = value("--token") ?? env["AL_SERVER_TOKEN"];
  return {
    port,
    host: value("--host") ?? "127.0.0.1",
    ...(token !== undefined && token !== "" && { token }),
  };
}
```

- [ ] **Step 4: Implement in `main.ts`**

Add `"@forkpoint/agent-lighthouse-server": "workspace:*"` to `dependencies` in `packages/cli/package.json` and run `pnpm install`.

Import `parseServeOptions` from `./options`. Add:

```ts
async function serve() {
  const opts = parseServeOptions(args);
  const loopback = opts.host === "127.0.0.1" || opts.host === "::1" || opts.host === "localhost";
  if (!loopback && opts.token === undefined)
    console.error(
      "\x1b[33mWarning:\x1b[0m listening beyond this machine without --token. Anyone who can reach the port can start scans.",
    );
  const { startServer } = await import("@forkpoint/agent-lighthouse-server");
  const server = await startServer(opts);
  printBanner();
  console.log(`Serving on ${server.url}  (Ctrl+C to stop)`);
  const stop = () => void server.close().then(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
```

In `main()`, after the help line:

```ts
  if (resolved.action === CliCommand.Serve) return serve();
```

In `usage()`, under `Usage:`, add:

```
  agent-lighthouse serve [--port <n>] [--host <addr>] [--token <t>]
```

and under `Options:` add:

```
  serve: --port <n>            Port for the task server [default: 8787]
  serve: --host <addr>         Address to bind [default: 127.0.0.1]
  serve: --token <t>           Require "Authorization: Bearer <t>" to start or cancel scans.
                               Also read from AL_SERVER_TOKEN
```

- [ ] **Step 5: Run the tests and try it**

Run: `AL_SKIP_NETWORK=1 pnpm test -- packages/cli && pnpm build && node packages/cli/dist/bin.js serve --port 8799`
Expected: tests PASS. The command prints `Serving on http://127.0.0.1:8799/`. In a second shell, `curl -s -X POST localhost:8799/tasks -H 'content-type: application/json' -d '{"url":"https://example.com"}'` returns `202` JSON with a `taskId`, and `curl -sN localhost:8799/tasks/<taskId>/stream` prints `event: snapshot` and then `event: progress` frames until `task.succeeded`. Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): add agent-lighthouse serve"
```

---

### Task 8: Release wiring, docs and the full check

**Files:**
- Modify: `.changeset/config.json` (fixed group)
- Modify: `scripts/check-package-types.mjs:33`, `scripts/smoke-packages.mjs:40` (package lists)
- Create: `docs/server.md`
- Modify: `docs/cli.md` (link to `serve`)
- Create: `.changeset/sse-task-server.md`

- [ ] **Step 1: Wire the package into release tooling**

In `.changeset/config.json`, add `"@forkpoint/agent-lighthouse-server"` to the `fixed` group.

In `scripts/check-package-types.mjs` and `scripts/smoke-packages.mjs`, change the list to:

```js
const PACKAGES = ["core", "report", "mcp", "server", "cli"];
```

`server` comes before `cli` because the CLI depends on it. Read `scripts/smoke-packages.mjs` around line 46 and add `"@forkpoint/agent-lighthouse-server"` to the package-name list there too.

- [ ] **Step 2: Write `docs/server.md`**

```md
# Task server

`agent-lighthouse serve` runs scans as tasks and streams their progress to a
browser over Server-Sent Events.

    npx @forkpoint/agent-lighthouse serve --port 8787

Open `http://127.0.0.1:8787/` for the built-in page, or use the routes below.

## Routes

| Method and path | Answer |
| :--- | :--- |
| `POST /tasks` | Body `{"url": "https://…"}`. Returns `202 {"taskId", "snapshot"}`. |
| `GET /tasks/:id` | The current snapshot. |
| `GET /tasks/:id/stream` | SSE. A `snapshot` frame, then one `progress` frame per event. |
| `GET /tasks/:id/updates?after=N` | Events after cursor `N`, plus the snapshot. For clients that cannot stream. |
| `GET /tasks/:id/result` | The scan report as JSON, once the task succeeded. |
| `DELETE /tasks/:id` | Cancels the task. |

## Frames

Every `progress` frame carries the event and the snapshot it produced:

    id: 42
    event: progress
    data: {"event":{"type":"work.settled",…,"cursor":42},"snapshot":{…,"cursor":42}}

A client renders the snapshot. A client that reconnects receives the
current snapshot as its first frame and needs no replay. A frame whose
snapshot cursor is lower than one already shown is stale; skip it.

`completed` counts work that ran, including an audit whose verdict is a
fail. `error` counts work that could not run. `skipped` counts audits that
were not assessed; `reasonCode` says why (`skipped`, `gated`, `budget`).

## Limits

Tasks live in memory. A restart loses them. Four scans run at once; more
answer `429`. A finished task stays readable for 60 minutes.

## Access

The server binds `127.0.0.1` by default. With `--host` set to another
address, pass `--token` (or `AL_SERVER_TOKEN`): starting and cancelling a
scan then need `Authorization: Bearer <token>`. Reads go by task id, a
random UUID. Target URLs that resolve to private or loopback addresses are
refused.

## Behind a proxy

Streaming fails silently when a proxy buffers the response. For nginx:

    location /tasks/ {
      proxy_pass http://127.0.0.1:8787;
      proxy_http_version 1.1;
      proxy_buffering off;
      proxy_read_timeout 1h;
    }

The server sends a comment frame every 15 seconds, under nginx's 60-second
and Cloudflare's 120-second idle limits. Serve over HTTP/2 where possible:
browsers allow only six HTTP/1.1 connections per host, shared across tabs.
```

In `docs/cli.md`, add one line under the commands list: ``- `agent-lighthouse serve` — run the task server. See [server.md](server.md).``

- [ ] **Step 3: Write the changeset** — `.changeset/sse-task-server.md`. It is `minor`; the 9.0.0 major changeset already on the branch sets the release version, and the fixed group carries the new package to 9.0.0 with the rest:

```md
---
"@forkpoint/agent-lighthouse": minor
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-mcp": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-server": minor
---

Add `agent-lighthouse serve` and the new `@forkpoint/agent-lighthouse-server`
package: scans run as tasks, and their progress streams to a browser over
Server-Sent Events, with a JSON polling route as a fallback. Core emits a new
`phase:total` scan event when a phase's planned total changes.
```

- [ ] **Step 4: Run all twelve checks**

```bash
pnpm build && AL_SKIP_NETWORK=1 pnpm test && pnpm typecheck && rtk err pnpm lint && pnpm check:dossiers && pnpm check:audit-boundaries && pnpm check:requires && pnpm check:audit-map && pnpm check:enums && pnpm knip && pnpm check:retired-names && pnpm check:package-types
```

Expected: every command exits 0. Likely failures and their fixes:
- `check:enums` flags a string literal: replace it with the enum constant. The page script inside the `PAGE_HTML` template string is not TypeScript and is not checked.
- `knip` flags an unused export: remove it from `index.ts` unless a test or the CLI uses it.
- `check:package-types` cannot find `packages/server/dist/index.d.ts`: run `pnpm build` again and confirm `tsconfig.build.json` lists `src/index.ts`.

Then run the CI form of the network suite once without the skip flag: `pnpm test -- packages/core/src/__tests__/verify-scan-results.test.ts`. Expected: PASS. Task 1 changed progress events only, not verdicts.

Run `pnpm format` and `pnpm smoke:packages`. Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add .changeset scripts docs packages
git commit -m "feat(server): release wiring, docs and changeset"
```

---

## Not in this plan

- A database store. `TaskStore` is the seam. A SQL store must keep the one rule in its JSDoc: cursor, snapshot and notify change as one step.
- Retries, leases and worker fencing. One process runs every scan, so no stale worker exists.
- A `work.started` event. Audits run in batches of 20, and the page shows the last settled unit instead of "Checking X".
- Frame throttling. A full scan emits about 250 events. Each frame is under 2 KiB.
- Removing the CLI's ETA. The design review asked for it, and it is a separate change.
