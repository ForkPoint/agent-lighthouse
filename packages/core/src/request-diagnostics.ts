import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";

export const RequestAbortSource = {
  RequestTimeout: "request-timeout",
  SiteBudget: "site-budget",
  Caller: "caller-cancellation",
  Scheduler: "scheduler-refusal",
  Transport: "transport-error",
  ResponseLimit: "response-limit",
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
  abortFinal: boolean;
  sendCount: number;
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
    timing.sendCount += 1;
    timing.value.headersSent = true;
    if (timing.sendCount > 1) {
      // Native retries reuse the same request object. Do not combine different
      // sends into a fabricated timing sample or protocol claim.
      timing.value.transportWaitMs = null;
      timing.value.responseWaitMs = null;
      timing.value.bodyMs = null;
      timing.value.protocol = null;
      return;
    }
    timing.sent = performance.now();
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
    if (timing.sendCount === 1 && timing.sent !== undefined)
      timing.value.responseWaitMs = Math.round(timing.headers - timing.sent);
  });
  listen("undici:request:trailers", (timing) => {
    timing.value.bodyEnded = true;
    if (timing.sendCount === 1 && timing.headers !== undefined)
      timing.value.bodyMs = Math.round(performance.now() - timing.headers);
  });
  listen("undici:request:error", (timing, event) => {
    timing.value.transportError = true;
    const error = event["error"] as { code?: unknown } | undefined;
    if (!timing.value.failureCode && typeof error?.code === "string")
      timing.value.failureCode = error.code;
    attributeAbort(timing, RequestAbortSource.Transport);
  });
}

function attributeAbort(timing: Timing, source: RequestAbortSource | null) {
  if (timing.abortFinal) return;
  timing.abortFinal = true;
  timing.value.abortSource = source;
}

/** Isolate one logical transport call; no URL or credential enters diagnostics. */
export function createRequestDiagnostics() {
  install();
  const timing: Timing = {
    start: performance.now(),
    done: false,
    abortFinal: false,
    sendCount: 0,
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
    attributeAbort(source: RequestAbortSource | null) {
      attributeAbort(timing, source);
    },
    run<T>(fn: () => T): T {
      timing.start = performance.now();
      return context.run(timing, fn);
    },
    finish() {
      timing.done = true;
    },
  };
}
