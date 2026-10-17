import * as fs from "node:fs";
import { runScan, type ScanOptions } from "#core/orchestrator";
import type { ScanReport } from "#core/types";
import { LogFormat, LogLevel, logger } from "#core/logger";

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

/**
 * Append every log line of the run to `path` as JSON lines, at debug level.
 *
 * Some sites answer a full scan with a 428 or a timeout while single requests
 * and a burst of the same URLs pass. A log of every request a scan made is
 * what tells those apart. The fetcher logs each request when it starts and
 * when it ends, with method, URL, user agent, status and duration, and each
 * line names its scan and site, so the six scans of a parallel run stay apart.
 * A request that never ends has a "started" line and no "finished" line, and
 * a scan that ends with requests still open names them.
 *
 * Returns a function that stops logging.
 */
export function startLogFile(path: string): () => void {
  const fd = fs.openSync(path, "a");
  const remove = logger.addSink({
    level: LogLevel.Debug,
    format: LogFormat.Json,
    write: (line) => fs.writeSync(fd, `${line}\n`),
  });
  return () => {
    remove();
    fs.closeSync(fd);
  };
}
