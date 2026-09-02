import type { ScanEvent } from "@forkpoint/agent-lighthouse-core";

export interface ProgressNotification {
  progressToken: string | number;
  progress: number;
  total: number;
}

export interface ProgressNotifierOptions {
  /** Minimum milliseconds between notifications. Default 1000 (~1/sec). */
  minIntervalMs?: number;
  now?: () => number;
}

/**
 * Builds a runScan `onEvent` handler that forwards scan progress as MCP
 * `notifications/progress` params, throttled to ~1/sec. The final 1.0 is
 * always sent. Returns undefined when the request carried no progressToken,
 * so callers can pass the result straight into `runScan(url, { onEvent })`.
 */
export function createProgressNotifier(
  progressToken: string | number | undefined,
  notify: (notification: ProgressNotification) => void,
  options: ProgressNotifierOptions = {},
): ((event: ScanEvent) => void) | undefined {
  if (progressToken === undefined) return undefined;
  const minInterval = options.minIntervalMs ?? 1000;
  const now = options.now ?? (() => Date.now());
  let lastSent = Number.NEGATIVE_INFINITY;

  const send = (fraction: number, force: boolean) => {
    const t = now();
    if (!force && t - lastSent < minInterval) return;
    lastSent = t;
    notify({ progressToken, progress: fraction, total: 1 });
  };

  return (event) => {
    switch (event.type) {
      case "unit:done":
      case "phase:start":
      case "phase:done":
        send(event.fraction, false);
        break;
      case "scan:done":
        send(event.fraction, true);
        break;
      default:
        break;
    }
  };
}
