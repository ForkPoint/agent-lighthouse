import { describe, it, expect } from 'vitest';
import { probeAsBot } from './bot-probe';
import type { FetchOptions, FetchResult } from '../fetcher';

const result = (status: number, error?: string): FetchResult => ({
  url: 'https://x.test/',
  finalUrl: 'https://x.test/',
  status,
  headers: {},
  body: '',
  ttfbMs: 1,
  totalMs: 2,
  contentType: 'text/html',
  contentLength: 0,
  ...(error ? { error } : {}),
});

const fetchReturning = (status: number, error?: string) => {
  const calls: FetchOptions[] = [];
  const fn = async (options: FetchOptions): Promise<FetchResult> => {
    calls.push(options);
    return result(status, error);
  };
  return { fn, calls };
};

describe('probeAsBot', () => {
  it('sends the bot user-agent on the probe request', async () => {
    const { fn, calls } = fetchReturning(200);
    await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(calls[0].userAgent).toBe('GPTBot/1.4');
  });
  it('flags edgeBlocked when baseline is 200 and bot gets 403', async () => {
    const { fn } = fetchReturning(403);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.edgeBlocked).toBe(true);
    expect(probe.signal).toBe('blocked');
    expect(probe.baselineStatus).toBe(200);
    expect(probe.botStatus).toBe(403);
  });
  it('is not edgeBlocked when both see 200', async () => {
    const { fn } = fetchReturning(200);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.edgeBlocked).toBe(false);
    expect(probe.signal).toBe('ok');
    expect(probe.probeError).toBeUndefined();
  });
  it('is not edgeBlocked when the baseline itself is blocked (site-wide, not bot-targeted)', async () => {
    const { fn } = fetchReturning(403);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(403));
    expect(probe.edgeBlocked).toBe(false);
    expect(probe.signal).toBe('ok');
  });
  it('reports inconclusive when the probe errors out on a healthy baseline', async () => {
    const { fn } = fetchReturning(0, 'ECONNRESET');
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.signal).toBe('inconclusive');
    expect(probe.probeError).toBe('ECONNRESET');
    // A transport failure is not evidence of a clean pass — but not of a block either.
    expect(probe.edgeBlocked).toBe(false);
  });
  it('reports inconclusive when the probe carries an error alongside a status', async () => {
    const { fn } = fetchReturning(200, 'TIMEOUT');
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.signal).toBe('inconclusive');
    expect(probe.probeError).toBe('TIMEOUT');
  });
  it('prefers blocked over inconclusive when the bot gets a real block status', async () => {
    const { fn } = fetchReturning(429, 'rate limited');
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.signal).toBe('blocked');
    expect(probe.probeError).toBe('rate limited');
  });
});
