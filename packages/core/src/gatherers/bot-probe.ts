import type { FetchOptions, FetchResult } from '../fetcher';

/**
 * - `blocked`: baseline was fine and the bot got a block status — UA-targeted blocking.
 * - `inconclusive`: baseline was fine but the probe never completed (transport
 *   error, connection reset, TLS challenge). Absence of a block is NOT a pass.
 * - `ok`: everything else, including a baseline that was already blocked
 *   site-wide (nothing bot-specific to report).
 */
export type BotProbeSignal = 'ok' | 'blocked' | 'inconclusive';

export interface BotProbeResult {
  botUserAgent: string;
  baselineStatus: number;
  botStatus: number;
  /** Kept for compatibility; identical to `signal === 'blocked'`. */
  edgeBlocked: boolean;
  /** Transport-level error from the probe fetch, when the request never completed. */
  probeError?: string;
  signal: BotProbeSignal;
}

const BLOCK_STATUSES = new Set([401, 403, 429, 503]);

/**
 * Refetch a URL presenting a real bot's User-Agent and compare with the
 * baseline scanner fetch. A clean baseline + blocked bot response is the
 * signature of UA-based edge blocking (e.g. Cloudflare "Block AI Scrapers"),
 * which robots.txt-based audits cannot see.
 */
export async function probeAsBot(
  fetch: (options: FetchOptions) => Promise<FetchResult>,
  url: string,
  botUserAgent: string,
  baseline: FetchResult,
): Promise<BotProbeResult> {
  const probe = await fetch({ url, userAgent: botUserAgent, followRedirects: true });
  const baselineOk = baseline.status >= 200 && baseline.status < 400;
  const botBlocked = BLOCK_STATUSES.has(probe.status);
  const edgeBlocked = baselineOk && botBlocked;
  // status 0 is the fetcher's "request never produced a response" sentinel.
  const probeFailed = Boolean(probe.error) || probe.status === 0;
  const signal: BotProbeSignal = edgeBlocked
    ? 'blocked'
    : baselineOk && probeFailed
      ? 'inconclusive'
      : 'ok';
  return {
    botUserAgent,
    baselineStatus: baseline.status,
    botStatus: probe.status,
    edgeBlocked,
    ...(probe.error ? { probeError: probe.error } : {}),
    signal,
  };
}
