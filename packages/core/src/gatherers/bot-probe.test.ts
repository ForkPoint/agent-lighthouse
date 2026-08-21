import { describe, it, expect } from 'vitest';
import { probeAsBot } from './bot-probe';
import type { FetchOptions, FetchResult } from '../fetcher';

const result = (status: number): FetchResult => ({
  url: 'https://x.test/',
  finalUrl: 'https://x.test/',
  status,
  headers: {},
  body: '',
  ttfbMs: 1,
  totalMs: 2,
  contentType: 'text/html',
  contentLength: 0,
});

const fetchReturning = (status: number) => {
  const calls: FetchOptions[] = [];
  const fn = async (options: FetchOptions): Promise<FetchResult> => {
    calls.push(options);
    return result(status);
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
    expect(probe.baselineStatus).toBe(200);
    expect(probe.botStatus).toBe(403);
  });
  it('is not edgeBlocked when both see 200', async () => {
    const { fn } = fetchReturning(200);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(200));
    expect(probe.edgeBlocked).toBe(false);
  });
  it('is not edgeBlocked when the baseline itself is blocked (site-wide, not bot-targeted)', async () => {
    const { fn } = fetchReturning(403);
    const probe = await probeAsBot(fn, 'https://x.test/', 'GPTBot/1.4', result(403));
    expect(probe.edgeBlocked).toBe(false);
  });
});
