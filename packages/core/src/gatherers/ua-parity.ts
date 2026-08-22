import type { FetchOptions, FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';
import { parseHtml, getMainContentText } from '../parser';

/**
 * The AI crawlers whose published User-Agent strings can actually be sent.
 *
 * `Google-Extended` is deliberately absent: it is a robots.txt product token
 * only, with no user agent of its own, so a UA probe for it would compare the
 * site against a string that never appears in real traffic.
 */
export const AI_CRAWLER_UAS: ReadonlyArray<{ token: string; ua: string; label: string }> = [
  {
    token: 'gptbot',
    label: 'GPTBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot',
  },
  {
    token: 'oai-searchbot',
    label: 'OAI-SearchBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  },
  {
    token: 'chatgpt-user',
    label: 'ChatGPT-User',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  },
  {
    token: 'claudebot',
    label: 'ClaudeBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  },
  {
    token: 'claude-user',
    label: 'Claude-User',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  },
  {
    token: 'perplexitybot',
    label: 'PerplexityBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  },
];

/** A mainstream browser UA. The control half of every pair. */
export const BASELINE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * How a site answered a crawler UA, relative to the same request as a browser.
 *
 * The classes are deliberately distinct rather than one "blocked" verdict:
 * a Cloudflare interstitial, a pay-per-crawl price, a proof-of-work wall and a
 * rate limit each need a different remedy from the operator, and an opaque 403
 * may even be correct impersonation defence.
 */
export type BlockClass =
  | 'ok'
  | 'cf-challenge'
  | 'pay-per-crawl'
  | 'anubis-pow'
  | 'rate-limited'
  | 'opaque-403'
  | 'soft-block'
  | 'transport-error';

export interface UaProbe {
  url: string;
  token: string;
  baselineStatus: number;
  probeStatus: number;
  blockClass: BlockClass;
  /** Probe main-content length over baseline main-content length. */
  textRatio: number;
  /** The shortest decisive fact — a header line, a status, a body marker. */
  evidence: string;
}

/** Below this share of the baseline's text, a 200 is a block wearing a 200. */
const SOFT_BLOCK_RATIO = 0.4;

/** Anubis serves this script path and this phrase on its interstitial. */
const ANUBIS_MARKERS = ['/.within.website/x/cmd/anubis/', 'Protected by Anubis'];

function mainTextLength(body: string): number {
  if (!body.trim()) return 0;
  return getMainContentText(parseHtml(body)).length;
}

/**
 * Compare one crawler-UA response against the browser baseline for the same URL.
 *
 * A non-2xx baseline yields `ok` for every probe: the scanner could not read the
 * page either, so nothing observed is bot-specific and reporting it would be a
 * finding about our own fetch.
 */
export function classifyResponse(
  baseline: FetchResult,
  probe: FetchResult,
): { blockClass: BlockClass; textRatio: number; evidence: string } {
  const baselineOk = baseline.status >= 200 && baseline.status < 300;
  if (!baselineOk) {
    return {
      blockClass: 'ok',
      textRatio: 1,
      evidence: 'baseline blocked; nothing bot-specific to report',
    };
  }

  const baselineLength = mainTextLength(baseline.body);
  const probeLength = mainTextLength(probe.body);
  // No baseline text means no denominator; a ratio of 1 says "no shortfall
  // measured" rather than inventing a division by zero.
  const textRatio = baselineLength === 0 ? 1 : probeLength / baselineLength;
  const done = (blockClass: BlockClass, evidence: string) => ({ blockClass, textRatio, evidence });

  const cfMitigated = probe.headers['cf-mitigated'];
  if (cfMitigated && cfMitigated.toLowerCase().includes('challenge')) {
    return done('cf-challenge', `cf-mitigated: ${cfMitigated}`);
  }
  if (probe.status === 402 && probe.headers['crawler-price'] !== undefined) {
    return done('pay-per-crawl', `402 with crawler-price: ${probe.headers['crawler-price']}`);
  }
  const marker = ANUBIS_MARKERS.find((m) => probe.body.includes(m));
  if (marker) return done('anubis-pow', `body contains "${marker}"`);
  if (probe.status === 429) return done('rate-limited', 'HTTP 429');
  if (probe.status === 403) return done('opaque-403', 'HTTP 403 with no challenge header');
  if (probe.error || probe.status === 0) {
    return done('transport-error', probe.error ?? 'no response');
  }
  if (probe.status === 200 && textRatio < SOFT_BLOCK_RATIO) {
    return done(
      'soft-block',
      `HTTP 200 with ${Math.round(textRatio * 100)}% of the baseline main-content text`,
    );
  }
  return done('ok', `HTTP ${probe.status}`);
}

/**
 * Fetch each URL once as a browser, then once per crawler token, and classify
 * the difference.
 *
 * The baseline is fetched once per URL and reused across tokens, so a six-token
 * sweep costs seven requests per URL rather than twelve. URLs are `isSafeUrl`-
 * gated because callers pass in addresses read out of site-controlled content.
 */
export async function probeUaParity(
  fetch: (options: FetchOptions) => Promise<FetchResult>,
  urls: string[],
  tokens: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<UaProbe[]> {
  const agents = tokens
    .map((token) => AI_CRAWLER_UAS.find((u) => u.token === token.toLowerCase()))
    .filter((u): u is (typeof AI_CRAWLER_UAS)[number] => u !== undefined);
  if (agents.length === 0) return [];

  const probes: UaProbe[] = [];
  for (const url of urls) {
    if (!(await isSafeUrl(url))) continue;
    const baseline = await fetch({
      url,
      userAgent: BASELINE_UA,
      followRedirects: true,
      signal: opts.signal,
    });
    for (const agent of agents) {
      const probe = await fetch({
        url,
        userAgent: agent.ua,
        followRedirects: true,
        signal: opts.signal,
      });
      const verdict = classifyResponse(baseline, probe);
      probes.push({
        url,
        token: agent.token,
        baselineStatus: baseline.status,
        probeStatus: probe.status,
        ...verdict,
      });
    }
  }
  return probes;
}

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface ProbeContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
}

interface ProbeCache {
  baselines: Map<string, Promise<FetchResult | undefined>>;
  probes: Map<string, Promise<UaProbe | undefined>>;
}

const probeCache = new WeakMap<object, ProbeCache>();

function cacheFor(ctx: object): ProbeCache {
  let cache = probeCache.get(ctx);
  if (!cache) {
    cache = { baselines: new Map(), probes: new Map() };
    probeCache.set(ctx, cache);
  }
  return cache;
}

/**
 * `probeUaParity`, with every request memoised for the life of one scan.
 *
 * Three audits probe overlapping URL sets with the same crawler UAs, and each
 * pair costs a real request to a live origin. Keyed on the CheckContext object,
 * so one scan shares its probes and two scans share nothing.
 */
export async function sharedUaProbes(
  ctx: ProbeContext,
  urls: string[],
  tokens: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<UaProbe[]> {
  const agents = tokens
    .map((token) => AI_CRAWLER_UAS.find((u) => u.token === token.toLowerCase()))
    .filter((u): u is (typeof AI_CRAWLER_UAS)[number] => u !== undefined);
  if (agents.length === 0) return [];

  const cache = cacheFor(ctx);
  const out: UaProbe[] = [];

  for (const url of urls) {
    let baseline = cache.baselines.get(url);
    if (!baseline) {
      baseline = (async () => {
        if (!(await isSafeUrl(url))) return undefined;
        return ctx.fetch({ url, userAgent: BASELINE_UA, followRedirects: true, signal: opts.signal });
      })();
      cache.baselines.set(url, baseline);
    }
    const baselineResult = await baseline;
    if (!baselineResult) continue;

    for (const agent of agents) {
      const key = `${agent.token}|${url}`;
      let pending = cache.probes.get(key);
      if (!pending) {
        pending = (async () => {
          const probe = await ctx.fetch({
            url,
            userAgent: agent.ua,
            followRedirects: true,
            signal: opts.signal,
          });
          return {
            url,
            token: agent.token,
            baselineStatus: baselineResult.status,
            probeStatus: probe.status,
            ...classifyResponse(baselineResult, probe),
          };
        })();
        cache.probes.set(key, pending);
      }
      const probe = await pending;
      if (probe) out.push(probe);
    }
  }
  return out;
}
