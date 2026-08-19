import type { PhaseId, ScanEvent } from "@forkpoint/agent-lighthouse-core";

export const PHASE_LABELS: Record<PhaseId, string> = {
  "fetch-root": "Root files",
  "fetch-pages": "Pages",
  analyze: "Page analysis",
  audits: "Audits",
  report: "Report",
};

const SPINNER = ["|", "/", "-", "\\"];
const BAR_WIDTH = 20;
const ETA_MIN_FRACTION = 0.05;
const ETA_MAX_MS = 5 * 60 * 1000;

export interface PhaseDoneInfo {
  phase: PhaseId;
  completed: number;
  total: number;
  durationMs: number;
  failures?: number;
  color?: boolean;
}

/** Permanent one-line summary printed when a phase finishes. */
export function formatPhaseDone(info: PhaseDoneInfo): string {
  const color = info.color ?? true;
  const seconds = (info.durationMs / 1000).toFixed(1);
  const check = color ? "\x1b[32m✓\x1b[0m" : "✓";
  let line = `${check} ${PHASE_LABELS[info.phase]} ${info.completed}/${info.total} · ${seconds}s`;
  if ((info.failures ?? 0) > 0) {
    const suffix = `· ${info.failures} errored`;
    line += color ? ` \x1b[33m${suffix}\x1b[0m` : ` ${suffix}`;
  }
  return line;
}

/** Human ETA from overall scan fraction, or null when unreliable/absurd. */
export function formatEta(fraction: number, elapsedMs: number): string | null {
  if (fraction <= ETA_MIN_FRACTION || fraction >= 1) return null;
  const etaMs = (elapsedMs * (1 - fraction)) / fraction;
  if (!Number.isFinite(etaMs) || etaMs < 0 || etaMs > ETA_MAX_MS) return null;
  return `~${Math.ceil(etaMs / 1000)}s left`;
}

export interface StatusLineInfo {
  spinnerIndex: number;
  label: string;
  completed: number;
  total: number;
  fraction: number;
  elapsedMs: number;
}

/** The sticky overwriting status line shown while a phase is active. */
export function formatStatusLine(info: StatusLineInfo): string {
  const spinner = SPINNER[info.spinnerIndex % SPINNER.length];
  const fraction = Math.min(1, Math.max(0, info.fraction));
  const filled = Math.round(fraction * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const pct = Math.round(fraction * 100);
  const eta = formatEta(info.fraction, info.elapsedMs);
  const counts = info.total > 0 ? ` ${info.completed}/${info.total}` : "";
  return `  \x1b[36m${spinner}\x1b[0m ${info.label}${counts} [${bar}] ${pct}%${eta ? ` ${eta}` : ""}`;
}

export interface ProgressRendererOptions {
  /** TTY: animate a sticky status line. Non-TTY: phase summaries only, no ANSI. */
  tty: boolean;
  write?: (text: string) => void;
  now?: () => number;
  minRenderIntervalMs?: number;
}

/**
 * Stateful ScanEvent consumer. Returns the `onEvent` handler for runScan.
 * Sticky-line renders are throttled; phase:done lines are always written;
 * scan:done only erases the sticky line (the report output follows).
 */
export function createProgressRenderer(
  options: ProgressRendererOptions,
): (event: ScanEvent) => void {
  const write = options.write ?? ((text: string) => process.stdout.write(text));
  const now = options.now ?? (() => Date.now());
  const minInterval = options.minRenderIntervalMs ?? 30;

  let spinnerIndex = 0;
  let lastRender = Number.NEGATIVE_INFINITY;
  let stickyShown = false;
  let label = "";
  let completed = 0;
  let total = 0;
  let failures = 0;

  const clearSticky = () => {
    if (stickyShown) {
      write("\r\x1b[K");
      stickyShown = false;
    }
  };

  const renderSticky = (fraction: number, elapsedMs: number) => {
    const t = now();
    if (t - lastRender < minInterval) return;
    lastRender = t;
    spinnerIndex += 1;
    write(
      "\r" +
        formatStatusLine({ spinnerIndex, label, completed, total, fraction, elapsedMs }) +
        "\x1b[K",
    );
    stickyShown = true;
  };

  return (event) => {
    switch (event.type) {
      case "scan:start":
        break;
      case "phase:start":
        label = PHASE_LABELS[event.phase];
        completed = 0;
        total = event.totalUnits;
        failures = 0;
        break;
      case "unit:done":
        completed = event.completed;
        total = event.total;
        if (options.tty) renderSticky(event.fraction, event.elapsedMs);
        break;
      case "unit:fail":
        // A failed unit still counts as settled work (see ProgressTracker).
        completed += 1;
        failures += 1;
        if (options.tty) renderSticky(event.fraction, event.elapsedMs);
        break;
      case "phase:done":
        clearSticky();
        write(
          formatPhaseDone({
            phase: event.phase,
            completed,
            total,
            durationMs: event.durationMs,
            failures,
            color: options.tty,
          }) + "\n",
        );
        failures = 0;
        break;
      case "scan:done":
        clearSticky();
        break;
    }
  };
}
