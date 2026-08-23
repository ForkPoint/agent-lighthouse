import { describe, it, expect, vi } from 'vitest';
import { RootTextFileResolutionIntegrityAudit } from './root-text-file-resolution-integrity';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions, FetchResult } from '../../fetcher';
import type { AuditResult } from '../../types';

vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
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

const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

interface Origin {
  /** What a root .txt path that does not exist answers. */
  probe?: (url: string, index: number) => FetchResult;
  robotsStatus?: number;
  robotsType?: string;
}

function run(origin: Origin = {}) {
  const audit = new RootTextFileResolutionIntegrityAudit();
  const ctx = mockCheckContext(
    [mockPageContext('https://example.com/', '<html><body><p>Hi.</p></body></html>')],
    { '/robots.txt': mockFetchResult('User-agent: *\nAllow: /\n', 200, 'text/plain') },
  );
  const requests: FetchOptions[] = [];
  let probeIndex = 0;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    if (new URL(o.url).pathname === '/robots.txt') {
      return mockFetchResult(
        'User-agent: *\nAllow: /\n',
        origin.robotsStatus ?? 200,
        origin.robotsType ?? 'text/plain',
      );
    }
    const result = origin.probe
      ? origin.probe(o.url, probeIndex)
      : mockFetchResult('', 404, 'text/plain');
    probeIndex += 1;
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

describe('RootTextFileResolutionIntegrityAudit', () => {
  const audit = new RootTextFileResolutionIntegrityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes when both random probes 404 and robots.txt is text/plain', async () => {
    const { result } = run();
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['discoveryProbeReliable']).toBe(true);
  });

  it('sends exactly three requests: two random probes and robots.txt', async () => {
    const { result, requests } = run();
    await result;
    expect(requests).toHaveLength(3);
    const probes = requests.filter((o) => new URL(o.url).pathname !== '/robots.txt');
    expect(probes).toHaveLength(2);
    for (const probe of probes) {
      expect(new URL(probe.url).pathname).toMatch(/^\/[0-9a-f]{32}\.txt$/);
      expect(probe.headers?.['Cache-Control']).toBe('no-cache');
      expect(probe.followRedirects).toBe(true);
    }
    // Two probes, two different names: one real file must not decide the verdict.
    expect(probes[0]!.url).not.toBe(probes[1]!.url);
  });

  it('classifies an HTML body as an SPA or HTML catch-all', async () => {
    const { result } = run({
      probe: () => mockFetchResult('<!doctype html><html><body>App</body></html>', 200, 'text/html'),
    });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('SPA or HTML catch-all');
    expect(r.details?.['discoveryProbeReliable']).toBe(false);
  });

  it('classifies a text body served as text/html as a wrong content type', async () => {
    const { result } = run({
      probe: (_url, index) => mockFetchResult(`plain body ${index}`, 200, 'text/html'),
    });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('wrong content type');
  });

  it('classifies two byte-identical bodies as a static catch-all', async () => {
    const { result } = run({ probe: () => mockFetchResult('fallback', 200, 'text/plain') });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('static catch-all');
  });

  it('fails a probe status that is neither 2xx nor 404/410', async () => {
    const { result } = run({ probe: () => mockFetchResult('', 403, 'text/plain') });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('403');
    expect(r.details?.['discoveryProbeReliable']).toBe(false);
  });

  it('accepts 410 as proof the origin resolves a missing file', async () => {
    const { result } = run({ probe: () => mockFetchResult('', 410, 'text/plain') });
    const r = await result;
    expect(r.status).toBe('pass');
  });

  it('fails a robots.txt served as application/octet-stream', async () => {
    const { result } = run({ robotsType: 'application/octet-stream' });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('text/plain');
    expect(r.details?.['discoveryProbeReliable']).toBe(false);
  });

  // A site with no robots.txt has no positive control, which is not the same
  // defect as an origin that mislabels the file it does serve.
  it('warns rather than fails when robots.txt is missing', async () => {
    const { result } = run({ robotsStatus: 404, robotsType: '' });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'warnings').join(' ')).toContain('positive control did not run');
    expect(r.details?.['discoveryProbeReliable']).toBe(false);
  });

  it('emits the derived flag and names the checks it qualifies', () => {
    const { meta } = RootTextFileResolutionIntegrityAudit;
    expect(meta.guidance?.impact).toContain('llms.txt');
    expect(meta.guidance?.impact).toContain('IndexNow');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
