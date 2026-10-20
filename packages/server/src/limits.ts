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
/** How long a detected payload stays reusable by a scan. */
export const DETECTION_TTL_MS = 10 * 60 * 1000;
/** Detected payloads kept in memory. The oldest is evicted first. */
export const MAX_DETECTIONS = 50;
/** HTML bytes kept across all detected payloads. The oldest is evicted first. */
export const MAX_DETECTION_BYTES = 32 * 1024 * 1024;
/** Detections that may run at once. More are refused with 429. */
export const MAX_RUNNING_DETECTS = 8;
/**
 * `POST /tasks` bodies read at once. A body can be 2.2 MiB, and the scan cap
 * counts scans, not bodies in flight, so this bounds their memory. More are
 * refused with 429.
 */
export const MAX_READING_TASK_BODIES = 8;
/** Deadline for a URL detection: its DNS check and its single page fetch. */
export const DETECT_FETCH_TIMEOUT_MS = 15_000;
/**
 * Largest body for `POST /detect` and `POST /tasks`: one snapshot's 2 MiB of
 * HTML, plus room for its metadata and JSON escaping. Every other route keeps
 * MAX_BODY_BYTES.
 */
export const MAX_PAYLOAD_BODY_BYTES = Math.floor(2.2 * 1024 * 1024);
