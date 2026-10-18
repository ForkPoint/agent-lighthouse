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
