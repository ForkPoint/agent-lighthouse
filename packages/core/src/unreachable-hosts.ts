/**
 * Hosts that refused a connection earlier in one scan.
 *
 * Audits fetch URLs read out of the site: sitemap entries, links, feeds. When
 * a sitemap lists pages on a host that never accepts a connection, every
 * fetch to it waits out the connect timeout, and several audits sample the
 * same sitemap one URL at a time. A handful of such URLs used up a 180 s scan
 * budget with the CPU idle. A browser would have given up on the host too.
 *
 * Only connect-level failures count: DNS, refused or unreachable, and the
 * connect timeout. A slow response, a reset stream or a TLS error says the
 * host is there, so it is never recorded.
 *
 * The scanned site's own hosts are never recorded. A connect timeout there can
 * be a one-off under load, and the scan must keep trying the site it reads.
 * The fetcher reports an error against the requested URL, not the redirect hop
 * that failed, so this also keeps a redirect from the site to a dead host from
 * marking the site itself.
 *
 * One instance lives for one scan, so nothing is shared between scans.
 */
import type { FetchResult } from "#core/fetcher";

const CONNECT_FAILURES = [
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
] as const;

/** True when a fetch failed before the host accepted a connection. */
export function isConnectFailure(result: FetchResult): boolean {
  if (result.status !== 0 || !result.error) return false;
  const error = result.error;
  return CONNECT_FAILURES.some((code) => error.includes(`(${code})`));
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function bareHost(host: string): string {
  return host.replace(/^www\./, "");
}

export class UnreachableHosts {
  private readonly own: string[];
  private readonly dead = new Map<string, string>();

  /** @param siteUrls URLs of the scanned site: the target and where it landed. */
  constructor(siteUrls: string[]) {
    this.own = siteUrls
      .map(hostOf)
      .filter((host): host is string => host !== undefined)
      .map(bareHost);
  }

  private isOwn(host: string): boolean {
    const bare = bareHost(host);
    return this.own.some((site) => bare === site || bare.endsWith(`.${site}`));
  }

  /** The earlier error for this URL's host, or undefined when it may be tried. */
  refusal(url: string): string | undefined {
    const host = hostOf(url);
    return host === undefined ? undefined : this.dead.get(host);
  }

  /** Remember the host of a fetch that failed to connect. */
  record(url: string, result: FetchResult): void {
    if (!isConnectFailure(result)) return;
    const host = hostOf(url);
    if (host === undefined || this.isOwn(host) || this.dead.has(host)) return;
    this.dead.set(
      host,
      `${host} refused a connection earlier in this scan: ${result.error}`,
    );
  }
}
