import { describe, it, expect, vi } from 'vitest';
import { TrustTxtReciprocityCoherenceAudit, parseTrustTxt } from './trust-txt-reciprocity-coherence';
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
        return (protocol === 'https:' || protocol === 'http:') && !/^(localhost|127\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

interface Site {
  /** The audited site's own trust.txt, or undefined for none. */
  trustTxt?: string;
  /** Other domains' trust.txt bodies, keyed by host. */
  others?: Record<string, string | number>;
  robotsTxt?: string;
}

function run(site: Site) {
  const audit = new TrustTxtReciprocityCoherenceAudit();
  const rootFiles: Record<string, FetchResult> = {};
  if (site.robotsTxt !== undefined) {
    rootFiles['/robots.txt'] = mockFetchResult(site.robotsTxt, 200, 'text/plain');
  }
  const ctx = mockCheckContext(
    [mockPageContext('https://example.com/', '<html><body><p>Hi.</p></body></html>')],
    rootFiles,
  );
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const url = new URL(o.url);
    if (url.host === 'example.com') {
      return url.pathname === '/trust.txt' && site.trustTxt !== undefined
        ? mockFetchResult(site.trustTxt, 200, 'text/plain')
        : mockFetchResult('', 404, 'text/plain');
    }
    const other = site.others?.[url.host];
    if (other === undefined) return mockFetchResult('', 404, 'text/plain');
    if (typeof other === 'number') return mockFetchResult('', other, 'text/plain');
    return mockFetchResult(other, 200, 'text/plain');
  };

  return { result: audit.audit(ctx), requests };
}

describe('TrustTxtReciprocityCoherenceAudit', () => {
  const audit = new TrustTxtReciprocityCoherenceAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the site publishes no trust.txt', async () => {
    const { result } = run({});
    expect((await result).status).toBe('na');
  });

  describe('parseTrustTxt', () => {
    it('reads name=value lines and drops comments', () => {
      const entries = parseTrustTxt('# a comment\nmember=https://a.test/\ncontact=mailto:x@a.test # trailing\n\n');
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ name: 'member', value: 'https://a.test/', line: 2 });
      expect(entries[1]?.value).toBe('mailto:x@a.test');
    });
  });

  it('passes when every association reciprocates and robots.txt agrees', async () => {
    const { result } = run({
      trustTxt: 'belongto=https://assoc.test/\ndatatrainingallowed=yes\n',
      others: { 'assoc.test': 'member=https://example.com/\n' },
      robotsTxt: 'User-agent: *\nAllow: /\n',
    });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(strings(r, 'reciprocated')).toHaveLength(1);
  });

  it('reports an association that does not list this domain back', async () => {
    const { result } = run({
      trustTxt: 'belongto=https://assoc.test/\n',
      others: { 'assoc.test': 'member=https://someone-else.test/\n' },
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('no member= line naming example.com');
  });

  it('reports an association whose trust.txt does not answer', async () => {
    const { result } = run({ trustTxt: 'belongto=https://assoc.test/\n', others: { 'assoc.test': 503 } });
    const r = await result;
    expect(strings(r, 'observations').join(' ')).toContain('503');
  });

  it('flags an attribute name the specification does not define', async () => {
    const { result } = run({ trustTxt: 'membr=https://assoc.test/\n' });
    const r = await result;
    expect(strings(r, 'observations').join(' ')).toContain('is not a trust.txt attribute');
  });

  // Two channels stating one policy, saying opposite things.
  it('reports datatrainingallowed=no beside a robots.txt that lets AI crawlers in', async () => {
    const { result } = run({
      trustTxt: 'datatrainingallowed=no\n',
      robotsTxt: 'User-agent: *\nAllow: /\n',
    });
    const r = await result;
    expect(strings(r, 'observations').join(' ')).toContain('the opposite');
    expect(strings(r, 'aiCrawlersAllowed')).toContain('GPTBot');
  });

  it('reports datatrainingallowed=yes beside a robots.txt that blocks them', async () => {
    const { result } = run({
      trustTxt: 'datatrainingallowed=yes\n',
      robotsTxt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n',
    });
    const r = await result;
    expect(strings(r, 'observations').join(' ')).toContain('the opposite');
  });

  it('checks at most three associations and says what it skipped', async () => {
    const { result, requests } = run({
      trustTxt: ['a', 'b', 'c', 'd', 'e'].map((h) => `belongto=https://${h}.test/`).join('\n'),
      others: {},
    });
    const r = await result;
    expect(requests.filter((o) => o.url.endsWith('.test/trust.txt'))).toHaveLength(3);
    expect(strings(r, 'observations').join(' ')).toContain('further association(s) were not checked');
  });

  it('never returns fail, whatever the input', async () => {
    const cases: Site[] = [
      {},
      { trustTxt: 'belongto=https://assoc.test/\n', others: { 'assoc.test': 404 } },
      { trustTxt: 'datatrainingallowed=no\n', robotsTxt: 'User-agent: *\nAllow: /\n' },
      { trustTxt: 'nonsense\nmembr=x\n' },
    ];
    for (const site of cases) {
      const r = await run(site).result;
      expect(r.status, JSON.stringify(site)).not.toBe('fail');
    }
  });

  it('registers as an informative grade-C audit that carries no weight', () => {
    const { meta } = TrustTxtReciprocityCoherenceAudit;
    expect(meta.evidenceGrade).toBe('C');
    expect(meta.tier).toBe('informative');
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe('informative');
    expect(meta.guidance?.impact).toContain('no AI engine');
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
