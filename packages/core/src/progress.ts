export type PhaseId =
  "fetch-root" | "fetch-pages" | "analyze" | "audits" | "report";

export type ScanEvent =
  | { type: "scan:start"; url: string; fraction: number; elapsedMs: number }
  | {
      type: "phase:start";
      phase: PhaseId;
      totalUnits: number;
      fraction: number;
      elapsedMs: number;
    }
  | {
      type: "unit:done";
      phase: PhaseId;
      completed: number;
      total: number;
      label?: string;
      fraction: number;
      elapsedMs: number;
    }
  | {
      type: "unit:fail";
      phase: PhaseId;
      label: string;
      error: string;
      fraction: number;
      elapsedMs: number;
    }
  | {
      type: "phase:done";
      phase: PhaseId;
      durationMs: number;
      fraction: number;
      elapsedMs: number;
    }
  | {
      type: "scan:done";
      durationMs: number;
      /** Null when the scan obtained too little evidence to judge the site. */
      score: number | null;
      fraction: number;
      elapsedMs: number;
    };

/**
 * How much of the overall scan fraction each phase owns. Sums to 1 so the
 * fraction of a finished scan is exactly 1.
 */
export const PHASE_WEIGHTS: Record<PhaseId, number> = {
  "fetch-root": 0.35,
  "fetch-pages": 0.2,
  analyze: 0.1,
  audits: 0.3,
  report: 0.05,
};

/**
 * Turns scan milestones into {@link ScanEvent}s. Owns the fraction math
 * (`Σ weights of done phases + current phase weight × completed/total`),
 * clamps it to be monotonic non-decreasing, and stamps `fraction`/`elapsedMs`
 * onto every event. Emission is synchronous — throttling is a consumer concern.
 */
export class ProgressTracker {
  private readonly onEvent: (event: ScanEvent) => void;
  private readonly startMs: number;
  private doneWeight = 0;
  private phase: PhaseId | null = null;
  private phaseStartMs = 0;
  private totalUnits = 0;
  private completedUnits = 0;
  private lastFraction = 0;

  constructor(onEvent: (event: ScanEvent) => void) {
    this.onEvent = onEvent;
    this.startMs = performance.now();
  }

  /** Fraction of the whole scan that is complete, in [0, 1]. Never decreases. */
  get fraction(): number {
    let f = this.doneWeight;
    if (this.phase !== null) {
      const ratio =
        this.totalUnits > 0
          ? Math.min(1, this.completedUnits / this.totalUnits)
          : 0;
      f += PHASE_WEIGHTS[this.phase] * ratio;
    }
    // Mid-phase total corrections (setPhaseTotal) and float noise must never
    // move the fraction backwards, and a finished scan must report exactly 1.
    return Math.min(1, Math.max(f, this.lastFraction));
  }

  /** Stamp an event with the current fraction/elapsed and advance the floor. */
  private stamp(): { fraction: number; elapsedMs: number } {
    const fraction = this.fraction;
    this.lastFraction = Math.max(this.lastFraction, fraction);
    return { fraction, elapsedMs: this.elapsedMs() };
  }

  private elapsedMs(): number {
    return Math.max(0, Math.round(performance.now() - this.startMs));
  }

  scanStart(url: string): void {
    this.onEvent({ type: "scan:start", url, ...this.stamp() });
  }

  phaseStart(phase: PhaseId, totalUnits: number): void {
    this.phase = phase;
    this.phaseStartMs = performance.now();
    this.totalUnits = Math.max(0, totalUnits);
    this.completedUnits = 0;
    this.onEvent({
      type: "phase:start",
      phase,
      totalUnits: this.totalUnits,
      ...this.stamp(),
    });
  }

  /** Correct the current phase's unit total (e.g. discovery finds pages mid-phase). */
  setPhaseTotal(totalUnits: number): void {
    this.totalUnits = Math.max(this.completedUnits, totalUnits);
  }

  unitDone(label?: string): void {
    const phase = this.phase;
    if (phase === null) return;
    this.completedUnits += 1;
    this.onEvent({
      type: "unit:done",
      phase,
      completed: this.completedUnits,
      total: this.totalUnits,
      label,
      ...this.stamp(),
    });
  }

  /** A failed unit still counts as settled work so the phase can complete. */
  unitFail(label: string, error: string): void {
    const phase = this.phase;
    if (phase === null) return;
    this.completedUnits += 1;
    this.onEvent({
      type: "unit:fail",
      phase,
      label,
      error,
      ...this.stamp(),
    });
  }

  phaseDone(): void {
    const phase = this.phase;
    if (phase === null) return;
    this.phase = null;
    this.doneWeight += PHASE_WEIGHTS[phase];
    const durationMs = Math.max(
      0,
      Math.round(performance.now() - this.phaseStartMs),
    );
    this.totalUnits = 0;
    this.completedUnits = 0;
    this.onEvent({
      type: "phase:done",
      phase,
      durationMs,
      ...this.stamp(),
    });
  }

  scanDone(score: number | null): void {
    this.onEvent({
      type: "scan:done",
      durationMs: this.elapsedMs(),
      score,
      ...this.stamp(),
    });
  }
}
