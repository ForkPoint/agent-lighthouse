import { describe, it, expect, vi } from 'vitest';
import {
  probeUaParity,
  sharedUaProbes,
  classifyResponse,
  AI_CRAWLER_UAS,
  BASELINE_UA,
} from './ua-parity';
import { mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions, FetchResult } from '../fetcher';

// isSafeUrl performs a real DNS lookup before the gatherer probes a URL it read
// out of site-controlled content. Stub it with an offline stand-in that still
// blocks loopback and private ranges, so the refusal test proves the gate
// rather than the mock.
vi.mock('../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const page = (text: string) =>
  `<html><body><main><article><p>${text}</p></article></main></body></html>`;

const ok = (text = 'the full article body '.repeat(40)) =>
  mockFetchResult(page(text), 200, 'text/html');

function res(
  status: number,
  headers: Record<string, string> = {},
  body = '',
): FetchResult {
  const r = mockFetchResult(body, status, 'text/html');
  Object.assign(r.headers, headers);
  return r;
}

describe('classifyResponse', () => {
  it('reports ok when the probe matches the baseline', () => {
    expect(classifyResponse(ok(), ok()).blockClass).toBe('ok');
  });

  // Precedence matters: a 403 that also carries cf-mitigated is a challenge,
  // not the ambiguous opaque block, and the operator's remedy differs.
  it('classifies cf-mitigated as a Cloudflare challenge ahead of the status', () => {
    const c = classifyResponse(ok(), res(403, { 'cf-mitigated': 'challenge' }));
    expect(c.blockClass).toBe('cf-challenge');
    expect(c.evidence).toContain('cf-mitigated');
  });

  it('classifies 402 with a crawler-price header as pay-per-crawl', () => {
    expect(classifyResponse(ok(), res(402, { 'crawler-price': 'USD 0.01' })).blockClass).toBe(
      'pay-per-crawl',
    );
  });

  it('classifies an Anubis body as a proof-of-work wall', () => {
    const anubis = res(200, {}, 'Protected by Anubis, please wait');
    expect(classifyResponse(ok(), anubis).blockClass).toBe('anubis-pow');
  });

  it('classifies the Anubis script path as a proof-of-work wall', () => {
    const anubis = res(200, {}, '<script src="/.within.website/x/cmd/anubis/static/js/main.mjs">');
    expect(classifyResponse(ok(), anubis).blockClass).toBe('anubis-pow');
  });

  it('classifies 429 as a rate limit', () => {
    expect(classifyResponse(ok(), res(429)).blockClass).toBe('rate-limited');
  });

  it('classifies a bare 403 as opaque', () => {
    const c = classifyResponse(ok(), res(403, { server: 'cloudflare' }));
    expect(c.blockClass).toBe('opaque-403');
  });

  it('classifies a transport error as such', () => {
    const broken = res(0);
    broken.error = 'socket hang up';
    expect(classifyResponse(ok(), broken).blockClass).toBe('transport-error');
  });

  it('classifies a truncated 200 as a soft block', () => {
    const c = classifyResponse(ok(), ok('stub'));
    expect(c.blockClass).toBe('soft-block');
    expect(c.textRatio).toBeLessThan(0.4);
  });

  // A scanner that cannot read the site itself has found nothing about the
  // site. Reporting that as a bot-specific block would be a false finding.
  it('reports ok for every probe when the baseline is itself blocked', () => {
    const c = classifyResponse(res(403), res(403));
    expect(c.blockClass).toBe('ok');
    expect(c.evidence).toContain('baseline blocked');
  });

  it('treats an empty baseline body as ratio 1 rather than dividing by zero', () => {
    const c = classifyResponse(res(200), res(200));
    expect(c.textRatio).toBe(1);
    expect(c.blockClass).toBe('ok');
  });
});

describe('probeUaParity', () => {
  function recorder(answer: (o: FetchOptions) => FetchResult) {
    const seen: Array<{ url: string; ua?: string }> = [];
    return {
      seen,
      fetch: async (o: FetchOptions) => {
        seen.push({ url: o.url, ua: o.userAgent });
        return answer(o);
      },
    };
  }

  it('issues one baseline per URL and one probe per URL per token', async () => {
    const r = recorder(() => ok());
    const probes = await probeUaParity(r.fetch, ['https://a.test/', 'https://a.test/x'], [
      'gptbot',
      'claudebot',
    ]);
    expect(probes).toHaveLength(4);
    expect(r.seen.filter((s) => s.ua === BASELINE_UA)).toHaveLength(2);
    expect(r.seen).toHaveLength(6);
  });

  it('sends each token its verbatim published UA string', async () => {
    const r = recorder(() => ok());
    await probeUaParity(r.fetch, ['https://a.test/'], ['gptbot']);
    const expected = AI_CRAWLER_UAS.find((u) => u.token === 'gptbot')!.ua;
    expect(r.seen.map((s) => s.ua)).toContain(expected);
  });

  it('skips a URL that fails the safety gate without fetching it', async () => {
    const r = recorder(() => ok());
    const probes = await probeUaParity(r.fetch, ['http://127.0.0.1/'], ['gptbot']);
    expect(probes).toEqual([]);
    expect(r.seen).toEqual([]);
  });

  it('ignores a token with no published user agent', async () => {
    const r = recorder(() => ok());
    const probes = await probeUaParity(r.fetch, ['https://a.test/'], ['google-extended']);
    expect(probes).toEqual([]);
  });

  it('carries the url and token on every probe', async () => {
    const r = recorder(() => ok());
    const probes = await probeUaParity(r.fetch, ['https://a.test/'], ['gptbot']);
    expect(probes[0]).toMatchObject({ url: 'https://a.test/', token: 'gptbot' });
  });

  it('records the baseline and probe statuses', async () => {
    const r = recorder((o) => (o.userAgent === BASELINE_UA ? ok() : res(403)));
    const probes = await probeUaParity(r.fetch, ['https://a.test/'], ['gptbot']);
    expect(probes[0]).toMatchObject({ baselineStatus: 200, probeStatus: 403 });
    expect(probes[0]!.blockClass).toBe('opaque-403');
  });
});

describe('AI_CRAWLER_UAS', () => {
  // Google-Extended is a robots.txt token with no user agent, so probing for it
  // would compare the site's response to a UA string that does not exist.
  it('excludes Google-Extended', () => {
    expect(AI_CRAWLER_UAS.map((u) => u.token)).not.toContain('google-extended');
  });

  it('covers the six probeable AI crawlers', () => {
    expect(AI_CRAWLER_UAS.map((u) => u.token).sort()).toEqual([
      'chatgpt-user',
      'claude-user',
      'claudebot',
      'gptbot',
      'oai-searchbot',
      'perplexitybot',
    ]);
  });

  it('carries the product token inside its own UA string', () => {
    for (const { token, ua } of AI_CRAWLER_UAS) {
      expect(ua.toLowerCase()).toContain(token);
    }
  });
});

describe('sharedUaProbes', () => {
  function scan() {
    const calls: Array<{ url: string; ua?: string }> = [];
    return {
      calls,
      fetch: async (o: FetchOptions): Promise<FetchResult> => {
        calls.push({ url: o.url, ...(o.userAgent ? { ua: o.userAgent } : {}) });
        return mockFetchResult('<html><body><main><p>Copy here.</p></main></body></html>', 200, 'text/html');
      },
    };
  }

  // Three audits probe overlapping URL sets, and every pair is a real request
  // to a live origin.
  it('fetches each baseline and each crawler pair once per scan', async () => {
    const ctx = scan();
    const first = await sharedUaProbes(ctx, ['https://example.com/'], ['gptbot', 'claudebot']);
    const second = await sharedUaProbes(ctx, ['https://example.com/'], ['gptbot']);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    // 1 baseline + 2 crawler probes, and nothing on the second call.
    expect(ctx.calls).toHaveLength(3);
  });

  it('does not share its cache between two scans', async () => {
    const first = scan();
    const second = scan();
    await sharedUaProbes(first, ['https://example.com/'], ['gptbot']);
    await sharedUaProbes(second, ['https://example.com/'], ['gptbot']);
    expect(first.calls).toHaveLength(2);
    expect(second.calls).toHaveLength(2);
  });

  it('never probes a URL that fails the SSRF gate', async () => {
    const ctx = scan();
    expect(await sharedUaProbes(ctx, ['https://localhost/'], ['gptbot'])).toEqual([]);
    expect(ctx.calls).toEqual([]);
  });
});
