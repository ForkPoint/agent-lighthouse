import { createHash } from "node:crypto";
import {
  createFetcher,
  detectPage,
  DocumentState,
  DomWorkLimitError,
  isSafeUrl,
  PayloadOrigin,
  type BrowserSnapshot,
  type PagePayload,
} from "@forkpoint/agent-lighthouse-core";
import { DETECT_FETCH_TIMEOUT_MS } from "./limits";
import type { DetectionEntry } from "./payload-store";

/** A detection refused with a status and a message the client may read. */
export class DetectError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DetectError";
  }
}

type Detected = Omit<DetectionEntry, "detectionId">;

/**
 * A short code for a failed fetch, not undici's prose: the fetcher ends its
 * error text with the cause's code, such as `(ECONNREFUSED)`. A deadline
 * carries no code and reads as `timeout`.
 */
function fetchErrorCode(error: string | undefined): string {
  const code = /\(([A-Z][A-Z0-9_]*)\)$/.exec(error ?? "")?.[1];
  if (code) return code;
  if (/timeout|timed out/i.test(error ?? "")) return "timeout";
  if (/abort/i.test(error ?? "")) return "aborted";
  return "fetch_error";
}

const HTML_TYPES = ["text/html", "application/xhtml+xml"];

function payloadOf(
  url: string,
  html: string,
  origin: PayloadOrigin,
): PagePayload {
  // Computed here, from the bytes the server holds; a client never sends it.
  const sha256 = createHash("sha256").update(html, "utf8").digest("hex");
  return { url, html, origin, sha256 };
}

function identify(
  payload: PagePayload,
  partial: boolean,
): Detected["identity"] {
  try {
    return detectPage(payload, { partial });
  } catch (error) {
    if (error instanceof DomWorkLimitError)
      throw new DetectError(422, "page_too_deep", "page too deep to assess");
    throw error;
  }
}

/**
 * A capture the client already validated against `BrowserSnapshotSchema`.
 * No fetch. A truncated, redacted or still-loading capture is partial: it
 * cannot show what the full page holds.
 */
export function detectSnapshot(snapshot: BrowserSnapshot): Detected {
  const payload = payloadOf(
    snapshot.requestedUrl,
    snapshot.html,
    PayloadOrigin.Supplied,
  );
  const partial =
    snapshot.truncation.truncated ||
    snapshot.redaction.redacted ||
    snapshot.documentState === DocumentState.Loading;
  return {
    target: snapshot.requestedUrl,
    payload,
    identity: identify(payload, partial),
    snapshot,
  };
}

/**
 * One request with the scanner's fetcher: its User-Agent and redirect
 * handling, with `isSafeUrl` on every hop. No robots.txt, sitemap or other
 * page is read, and a gateway target is reported, not followed.
 */
export async function detectUrl(target: URL, shown: string): Promise<Detected> {
  // One deadline covers the DNS check and the fetch. A lookup cannot be
  // aborted, so it races the deadline instead.
  const deadline = Date.now() + DETECT_FETCH_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  const safe = await Promise.race([
    isSafeUrl(target.href),
    new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), DETECT_FETCH_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  if (safe === "timeout") throw new DetectError(502, "fetch_failed", "timeout");
  if (!safe) throw new DetectError(400, "unsafe_url", "unsafe URL");
  const response = await createFetcher().fetch({
    url: target.href,
    timeout: Math.max(1, deadline - Date.now()),
  });
  // A redirect hop into private address space is refused by the fetcher.
  if (response.error === "redirect-refused")
    throw new DetectError(400, "unsafe_url", "unsafe URL");
  if (response.error !== undefined || response.status === 0)
    throw new DetectError(502, "fetch_failed", fetchErrorCode(response.error));
  if (response.status >= 400)
    throw new DetectError(
      422,
      "page_status",
      `page returned HTTP ${response.status}`,
    );
  const type = (
    response.contentType ||
    response.headers["content-type"] ||
    ""
  ).toLowerCase();
  if (!HTML_TYPES.some((html) => type.includes(html)))
    throw new DetectError(422, "not_html", "not an HTML page");
  const payload = payloadOf(shown, response.body, PayloadOrigin.Fetched);
  return {
    target: target.href,
    payload,
    identity: identify(payload, false),
    response,
  };
}
