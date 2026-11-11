import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";

export const RequestAbortSource = {
  RequestTimeout: "request-timeout",
  SiteBudget: "site-budget",
  Caller: "caller-cancellation",
  Scheduler: "scheduler-refusal",
  Transport: "transport-error",
} as const;
export type RequestAbortSource =
  (typeof RequestAbortSource)[keyof typeof RequestAbortSource];

export interface RequestDiagnostics {
  /** Independent per-hop durations. Null means the event was not observed. */
  transportWaitMs: number | null;
  connectionSetupMs: number | null;
  responseWaitMs: number | null;
  bodyMs: number | null;
  protocol: string | null;
  /** Undici emitted sendHeaders. This is not proof of socket flush or peer receipt. */
  headersSent: true | null;
  created: boolean;
  bodyEnded: boolean;
  responseHeaders: boolean;
  transportError: boolean;
  abortSource: RequestAbortSource | null;
  failureCode?: string;
}

interface Timing {
  value: RequestDiagnostics;
  start: number;
  sent?: number;
  headers?: number;
  done: boolean;
}
const context = new AsyncLocalStorage<Timing>();
const requests = new WeakMap<object, Timing>();

// Install one bounded listener set for all fetchers. Request object identity,
// rather than URL or async socket context, correlates every later event.
function listen(
  name: string,
  apply: (timing: Timing, event: Record<string, unknown>) => void,
) {
  channel(name).subscribe((message) => {
    try {
      if (typeof message !== "object" || message === null) return;
      const event = message as Record<string, unknown>;
      const request = event["request"];
      if (typeof request !== "object" || request === null) return;
      let timing = requests.get(request);
      if (name === "undici:request:create") {
        timing = context.getStore();
        if (timing && !timing.done) requests.set(request, timing);
      }
      if (timing && !timing.done) apply(timing, event);
    } catch {
      // Observability must never change transport behavior.
    }
  });
}

// Listeners attach on first use, not at import: while any is attached, Undici
// publishes every request in the process, the scanner's or not.
let installed = false;
function install(): void {
  if (installed) return;
  installed = true;
  listen("undici:request:create", (timing) => {
    timing.value.created = true;
  });
  listen("undici:client:sendHeaders", (timing, event) => {
    timing.sent = performance.now();
    timing.value.headersSent = true;
    timing.value.transportWaitMs = Math.round(timing.sent - timing.start);
    const socket = event["socket"] as { alpnProtocol?: unknown } | undefined;
    timing.value.protocol = socket
      ? socket.alpnProtocol === "h2"
        ? "h2"
        : "http/1.1"
      : null;
  });
  listen("undici:request:headers", (timing) => {
    timing.value.responseHeaders = true;
    timing.headers = performance.now();
    if (timing.sent !== undefined)
      timing.value.responseWaitMs = Math.round(timing.headers - timing.sent);
  });
  listen("undici:request:trailers", (timing) => {
    timing.value.bodyEnded = true;
    if (timing.headers !== undefined)
      timing.value.bodyMs = Math.round(performance.now() - timing.headers);
  });
  listen("undici:request:error", (timing) => {
    timing.value.transportError = true;
    timing.value.abortSource ??= RequestAbortSource.Transport;
  });
}

/** Isolate one logical transport call; no URL or credential enters diagnostics. */
export function createRequestDiagnostics() {
  install();
  const timing: Timing = {
    start: performance.now(),
    done: false,
    value: {
      transportWaitMs: null,
      connectionSetupMs: null,
      responseWaitMs: null,
      bodyMs: null,
      protocol: null,
      headersSent: null,
      created: false,
      responseHeaders: false,
      bodyEnded: false,
      transportError: false,
      abortSource: null,
    },
  };
  return {
    value: timing.value,
    run<T>(fn: () => T): T {
      timing.start = performance.now();
      return context.run(timing, fn);
    },
    finish() {
      timing.done = true;
    },
  };
}
