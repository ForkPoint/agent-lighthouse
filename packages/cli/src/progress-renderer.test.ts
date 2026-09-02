import { describe, it, expect } from "vitest";
import type { ScanEvent } from "@forkpoint/agent-lighthouse-core";
import {
  createProgressRenderer,
  formatEta,
  formatPhaseDone,
  formatStatusLine,
} from "./progress-renderer";

describe("formatPhaseDone", () => {
  it("renders label, counts and duration with a green check", () => {
    const line = formatPhaseDone({
      phase: "fetch-root",
      completed: 34,
      total: 34,
      durationMs: 1234,
    });
    expect(line).toBe("\x1b[32m✓\x1b[0m Root files 34/34 · 1.2s");
  });

  it("appends a yellow errored suffix when failures > 0", () => {
    const line = formatPhaseDone({
      phase: "audits",
      completed: 207,
      total: 207,
      durationMs: 5000,
      failures: 3,
    });
    expect(line).toContain("Audits 207/207 · 5.0s");
    expect(line).toContain("\x1b[33m· 3 errored\x1b[0m");
  });

  it("omits ANSI codes when color is disabled", () => {
    const line = formatPhaseDone({
      phase: "report",
      completed: 1,
      total: 1,
      durationMs: 100,
      failures: 2,
      color: false,
    });
    expect(line).toBe("✓ Report 1/1 · 0.1s · 2 errored");
    expect(line).not.toContain("\x1b");
  });
});

describe("formatEta", () => {
  it("returns null below the 5% threshold", () => {
    expect(formatEta(0.05, 10_000)).toBeNull();
  });

  it("estimates remaining time from fraction and elapsed", () => {
    // 10s elapsed at 50% → 10s remaining.
    expect(formatEta(0.5, 10_000)).toBe("~10s left");
  });

  it("hides absurd estimates (> 5min) and nonsense input", () => {
    expect(formatEta(0.051, 60_000)).toBeNull(); // ~18min
    expect(formatEta(0.5, Number.NaN)).toBeNull();
    expect(formatEta(1, 1000)).toBeNull();
  });
});

describe("formatStatusLine", () => {
  it("renders spinner, label, counts, bar and percent", () => {
    const line = formatStatusLine({
      spinnerIndex: 0,
      label: "Audits",
      completed: 100,
      total: 207,
      fraction: 0.5,
      elapsedMs: 10_000,
    });
    expect(line).toContain("|");
    expect(line).toContain("Audits 100/207");
    expect(line).toContain("[██████████░░░░░░░░░░] 50%");
    expect(line).toContain("~10s left");
  });

  it("never shows per-unit labels (only completed/total)", () => {
    const line = formatStatusLine({
      spinnerIndex: 1,
      label: "Audits",
      completed: 3,
      total: 207,
      fraction: 0.1,
      elapsedMs: 1000,
    });
    expect(line).not.toContain("3.1");
    expect(line).toContain("3/207");
  });

  it("clamps the bar for out-of-range fractions", () => {
    const line = formatStatusLine({
      spinnerIndex: 0,
      label: "Report",
      completed: 1,
      total: 1,
      fraction: 1.5,
      elapsedMs: 100,
    });
    expect(line).toContain("[████████████████████] 100%");
  });
});

describe("createProgressRenderer", () => {
  const unitDone = (
    over: Partial<Extract<ScanEvent, { type: "unit:done" }>> = {},
  ): ScanEvent => ({
    type: "unit:done",
    phase: "audits",
    completed: 1,
    total: 207,
    fraction: 0.5,
    elapsedMs: 100,
    ...over,
  });

  it("non-TTY writes only plain phase:done lines", () => {
    const out: string[] = [];
    const handle = createProgressRenderer({
      tty: false,
      write: (t) => out.push(t),
    });
    handle({
      type: "phase:start",
      phase: "fetch-root",
      totalUnits: 34,
      fraction: 0,
      elapsedMs: 0,
    });
    handle(
      unitDone({
        phase: "fetch-root",
        completed: 34,
        total: 34,
        fraction: 0.35,
      }),
    );
    handle({
      type: "phase:done",
      phase: "fetch-root",
      durationMs: 2000,
      fraction: 0.35,
      elapsedMs: 2000,
    });
    expect(out).toEqual(["✓ Root files 34/34 · 2.0s\n"]);
    expect(out.join("")).not.toContain("\x1b");
  });

  it("TTY throttles sticky renders but always writes phase:done and clears on scan:done", () => {
    const out: string[] = [];
    let t = 0;
    const handle = createProgressRenderer({
      tty: true,
      write: (s) => out.push(s),
      now: () => t,
      minRenderIntervalMs: 30,
    });
    handle({
      type: "phase:start",
      phase: "audits",
      totalUnits: 207,
      fraction: 0.45,
      elapsedMs: 0,
    });
    handle(unitDone()); // t=0 → renders (first render always allowed)
    t = 10;
    handle(unitDone({ completed: 2 })); // within 30ms → skipped
    t = 40;
    handle(unitDone({ completed: 3 })); // renders
    const sticky = out.filter((s) => s.startsWith("\r"));
    expect(sticky).toHaveLength(2);

    handle({
      type: "phase:done",
      phase: "audits",
      durationMs: 100,
      fraction: 0.75,
      elapsedMs: 100,
    });
    // phase:done erases the sticky line, then writes the permanent summary.
    expect(out[2]).toBe("\r\x1b[K");
    expect(out[3]).toContain("Audits 3/207");

    out.length = 0;
    handle({
      type: "scan:done",
      durationMs: 5000,
      score: 80,
      fraction: 1,
      elapsedMs: 5000,
    });
    expect(out).toEqual([]); // sticky already erased; report output follows
  });

  it("counts unit:fail silently and reports them on phase:done", () => {
    const out: string[] = [];
    const handle = createProgressRenderer({
      tty: false,
      write: (s) => out.push(s),
    });
    handle({
      type: "phase:start",
      phase: "audits",
      totalUnits: 2,
      fraction: 0.45,
      elapsedMs: 0,
    });
    handle(unitDone({ completed: 1, total: 2 }));
    handle({
      type: "unit:fail",
      phase: "audits",
      label: "3.1 JSON-LD present",
      error: "boom",
      fraction: 0.46,
      elapsedMs: 10,
    });
    handle({
      type: "phase:done",
      phase: "audits",
      durationMs: 100,
      fraction: 0.75,
      elapsedMs: 100,
    });
    expect(out).toEqual(["✓ Audits 2/2 · 0.1s · 1 errored\n"]);
  });
});
