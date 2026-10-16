import * as fs from "node:fs";
import diagnosticsChannel from "node:diagnostics_channel";
import { runScan, type ScanOptions } from "#core/orchestrator";
import type { ScanReport } from "#core/types";

/**
 * Shared pieces of the live corpus runners (`test-live-sites.ts` and
 * `scan-site-list.ts`).
 *
 * These runners test the scanner. They are not crawlers, so a site's
 * `robots.txt` does not decide whether it is scanned; a WAF block still ends a
 * scan, and the report says so.
 */

/**
 * The `Accept-Language` every corpus scan sends. Many storefronts pick a
 * locale, and sometimes a different domain, from the visitor's location and
 * language. A fixed language keeps the second input constant between runs, so
 * a change in a site's result is not a change in what the runner asked for.
 */
export const CORPUS_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

export interface DomainScan {
  report: ScanReport;
  /** The URL whose scan is `report`. */
  scannedUrl: string;
  /** Present when `https://<domain>/` failed and another origin was scanned. */
  originFallback?: { from: string; to: string };
}

/**
 * Scan a corpus domain, falling back to another origin when the bare domain
 * cannot be reached.
 *
 * The corpus lists bare domains, and the runner turns each into
 * `https://<domain>`. Some apex hosts refuse port 443, time out, or serve an
 * expired or mismatched certificate while `www.<domain>` answers. A visitor
 * who typed the brand name would reach the site, so the runner tries
 * `https://www.<domain>`, then `http://<domain>` (which usually redirects to a
 * working origin). It falls back only on a connection failure (no HTTP
 * status at all), never on an HTTP answer: a 403 or 404 is the site speaking.
 */
export async function scanDomain(
  domain: string,
  options: ScanOptions,
): Promise<DomainScan> {
  const scan = (url: string) =>
    runScan(url, {
      ...options,
      headers: {
        "Accept-Language": CORPUS_ACCEPT_LANGUAGE,
        ...options.headers,
      },
    });

  const first = `https://${domain}`;
  const report = await scan(first);
  if (!unreachable(report)) return { report, scannedUrl: first };

  const candidates = [
    ...(domain.startsWith("www.") ? [] : [`https://www.${domain}`]),
    `http://${domain}`,
  ];
  for (const candidate of candidates) {
    const retry = await scan(candidate);
    if (!unreachable(retry))
      return {
        report: retry,
        scannedUrl: candidate,
        originFallback: { from: first, to: candidate },
      };
  }
  return { report, scannedUrl: first };
}

/** No page of the scan got an HTTP status: the origin was never reached. */
function unreachable(report: ScanReport): boolean {
  const attempts = report.pageAttempts ?? [];
  return attempts.length > 0 && attempts.every((a) => a.status === 0);
}

/**
 * The country the run's requests leave from, as Cloudflare's trace endpoint
 * reports it, or undefined when the lookup fails.
 *
 * Geo redirects are part of what a corpus run measures: the same storefront
 * can answer a 404, a redirect loop or another domain depending on where the
 * request comes from. Recording the location lets two runs be compared.
 */
export async function scanLocation(): Promise<string | undefined> {
  try {
    const response = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.text();
    return /^loc=([A-Z]{2})$/m.exec(body)?.[1];
  } catch {
    return undefined;
  }
}

interface LoggedRequest {
  started: number;
  method: string;
  url: string;
  userAgent: string;
}

/**
 * Append one JSON line per HTTP request of the run to `path`, with its method,
 * URL, user agent, status (0 for a failed request) and duration.
 *
 * Some sites answer a full scan with a 428 or a timeout while single requests
 * and a burst of the same URLs pass. A log of every request a scan made is
 * what tells those apart. It reads undici's diagnostics channels, so it sees
 * every request the scanner's fetcher makes without a hook in the scanner.
 *
 * Returns a function that stops logging.
 */
export function startRequestLog(path: string): () => void {
  const pending = new WeakMap<object, LoggedRequest>();
  const write = (entry: LoggedRequest, status: number, error?: string) =>
    fs.appendFileSync(
      path,
      JSON.stringify({
        at: new Date(entry.started).toISOString(),
        method: entry.method,
        url: entry.url,
        userAgent: entry.userAgent,
        status,
        ms: Date.now() - entry.started,
        ...(error !== undefined && { error }),
      }) + "\n",
    );

  const onCreate = (message: unknown) => {
    const { request } = message as { request: UndiciRequest };
    pending.set(request, {
      started: Date.now(),
      method: request.method,
      url: `${request.origin}${request.path}`,
      userAgent: headerValue(request.headers, "user-agent") ?? "",
    });
  };
  const onHeaders = (message: unknown) => {
    const { request, response } = message as {
      request: UndiciRequest;
      response: { statusCode: number };
    };
    const entry = pending.get(request);
    if (!entry) return;
    pending.delete(request);
    write(entry, response.statusCode);
  };
  const onError = (message: unknown) => {
    const { request, error } = message as {
      request: UndiciRequest;
      error: Error;
    };
    const entry = pending.get(request);
    if (!entry) return;
    pending.delete(request);
    write(entry, 0, error.message);
  };

  diagnosticsChannel.subscribe("undici:request:create", onCreate);
  diagnosticsChannel.subscribe("undici:request:headers", onHeaders);
  diagnosticsChannel.subscribe("undici:request:error", onError);
  return () => {
    diagnosticsChannel.unsubscribe("undici:request:create", onCreate);
    diagnosticsChannel.unsubscribe("undici:request:headers", onHeaders);
    diagnosticsChannel.unsubscribe("undici:request:error", onError);
  };
}

interface UndiciRequest {
  origin: string;
  path: string;
  method: string;
  headers: string | string[];
}

/** One header from undici's raw form: a flat `[name, value, ...]` array or a `name: value\r\n` string. */
function headerValue(
  headers: string | string[],
  name: string,
): string | undefined {
  if (Array.isArray(headers)) {
    for (let i = 0; i + 1 < headers.length; i += 2)
      if (headers[i]!.toLowerCase() === name) return headers[i + 1];
    return undefined;
  }
  for (const line of headers.split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon > 0 && line.slice(0, colon).trim().toLowerCase() === name)
      return line.slice(colon + 1).trim();
  }
  return undefined;
}
