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
