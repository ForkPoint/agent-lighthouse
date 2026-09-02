import { describe, it, expect } from "vitest";
import { ProgressTracker, PHASE_WEIGHTS } from "./progress";
import type { PhaseId, ScanEvent } from "./progress";

function collect(): { events: ScanEvent[]; tracker: ProgressTracker } {
  const events: ScanEvent[] = [];
  return { events, tracker: new ProgressTracker((e) => events.push(e)) };
}

const PHASES: PhaseId[] = [
  "fetch-root",
  "fetch-pages",
  "analyze",
  "audits",
  "report",
];

describe("ProgressTracker", () => {
  it("phase weights sum to 1", () => {
    const sum = Object.values(PHASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("fraction after each phase:done equals the cumulative weight", () => {
    const { events, tracker } = collect();
    let expected = 0;
    tracker.scanStart("https://example.com/");
    for (const phase of PHASES) {
      tracker.phaseStart(phase, 4);
      tracker.unitDone();
      tracker.unitDone();
      tracker.phaseDone();
      expected += PHASE_WEIGHTS[phase];
      const done = events.filter((e) => e.type === "phase:done").at(-1)!;
      expect(done.fraction).toBeCloseTo(expected, 10);
    }
    tracker.scanDone(87);
    const last = events.at(-1)!;
    expect(last.type).toBe("scan:done");
    expect(last.fraction).toBe(1);
  });

  it("fraction within a phase tracks completed/total × phase weight", () => {
    const { tracker } = collect();
    tracker.scanStart("https://example.com/");
    tracker.phaseStart("fetch-root", 4);
    tracker.unitDone();
    expect(tracker.fraction).toBeCloseTo(
      PHASE_WEIGHTS["fetch-root"] * 0.25,
      10,
    );
    tracker.unitDone();
    tracker.unitDone();
    expect(tracker.fraction).toBeCloseTo(
      PHASE_WEIGHTS["fetch-root"] * 0.75,
      10,
    );
  });

  it("is monotonic non-decreasing across a simulated full scan", () => {
    const { events, tracker } = collect();
    tracker.scanStart("https://example.com/");
    tracker.phaseStart("fetch-root", 36);
    for (let i = 0; i < 36; i++) tracker.unitDone(`/file-${i}`);
    tracker.phaseDone();
    tracker.phaseStart("fetch-pages", 1);
    tracker.unitDone("https://example.com/");
    tracker.setPhaseTotal(6);
    for (let i = 0; i < 5; i++) tracker.unitDone(`https://example.com/p${i}`);
    tracker.phaseDone();
    tracker.phaseStart("analyze", 6);
    for (let i = 0; i < 6; i++) tracker.unitDone();
    tracker.phaseDone();
    tracker.phaseStart("audits", 207);
    for (let i = 0; i < 206; i++) tracker.unitDone(`1.${i} t`);
    tracker.unitFail("9.9 broken", "boom");
    tracker.phaseDone();
    tracker.phaseStart("report", 1);
    tracker.unitDone();
    tracker.phaseDone();
    tracker.scanDone(42);

    let prev = -1;
    for (const e of events) {
      expect(e.fraction).toBeGreaterThanOrEqual(prev);
      expect(e.fraction).toBeLessThanOrEqual(1);
      expect(e.elapsedMs).toBeGreaterThanOrEqual(0);
      prev = e.fraction;
    }
    expect(events.at(-1)!.fraction).toBe(1);
  });

  it("unit:fail counts as settled work and carries the error", () => {
    const { events, tracker } = collect();
    tracker.phaseStart("audits", 2);
    tracker.unitFail("a A", "kaboom");
    tracker.unitDone("b B");
    const fail = events.find((e) => e.type === "unit:fail")!;
    expect(fail).toMatchObject({
      phase: "audits",
      label: "a A",
      error: "kaboom",
    });
    expect(tracker.fraction).toBeCloseTo(PHASE_WEIGHTS.audits, 10);
  });

  it("setPhaseTotal corrects the total upward without moving fraction backwards", () => {
    const { events, tracker } = collect();
    tracker.phaseStart("fetch-pages", 1);
    tracker.unitDone("https://example.com/");
    const before = tracker.fraction;
    expect(before).toBeCloseTo(PHASE_WEIGHTS["fetch-pages"], 10);
    // Discovery finds 5 more pages mid-phase: fraction would drop, clamp holds it.
    tracker.setPhaseTotal(6);
    tracker.unitDone("https://example.com/a");
    const after = events.at(-1)!;
    expect(after.type).toBe("unit:done");
    expect(after.fraction).toBeGreaterThanOrEqual(before);
    if (after.type === "unit:done") expect(after.total).toBe(6);
  });

  it("setPhaseTotal never shrinks below the completed count", () => {
    const { tracker } = collect();
    tracker.phaseStart("fetch-pages", 1);
    tracker.unitDone();
    tracker.setPhaseTotal(0);
    expect(tracker.fraction).toBeCloseTo(PHASE_WEIGHTS["fetch-pages"], 10);
  });

  it("stamps scan:done with score and duration", () => {
    const { events, tracker } = collect();
    tracker.scanStart("https://example.com/");
    tracker.scanDone(73);
    const done = events.at(-1)!;
    expect(done).toMatchObject({ type: "scan:done", score: 73 });
    if (done.type === "scan:done")
      expect(done.durationMs).toBeGreaterThanOrEqual(0);
  });
});
