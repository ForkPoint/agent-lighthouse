import type { FetchOptions, FetchResult } from '../fetcher';

export interface BotProbeResult {
  botUserAgent: string;
  baselineStatus: number;
  botStatus: number;
  edgeBlocked: boolean;
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
  return {
    botUserAgent,
    baselineStatus: baseline.status,
    botStatus: probe.status,
    edgeBlocked: baselineOk && botBlocked,
  };
}
