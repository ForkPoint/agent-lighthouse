import { describe, it, expect } from 'vitest';
import { RobotsAiGroupShadowingAudit } from './robots-ai-group-shadowing';
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';
import type { FetchResult } from '../../fetcher';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

function run(robots: string | undefined, pageUrls: string[] = ['https://example.com/']) {
  const audit = new RobotsAiGroupShadowingAudit();
  const pages = pageUrls.map((url, i) =>
    mockPageContext(url, '<html><head></head><body><main><p>Copy.</p></main></body></html>', i),
  );
  const rootFiles: Record<string, FetchResult> =
    robots === undefined ? {} : { '/robots.txt': mockFetchResult(robots, 200, 'text/plain') };
  return audit.audit(mockCheckContext(pages, rootFiles));
}

describe('RobotsAiGroupShadowingAudit', () => {
  const audit = new RobotsAiGroupShadowingAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the site serves no robots.txt', () => {
    expect(run(undefined).status).toBe('na');
  });

  // RFC 9309 §2.2.1: once a named group exists, the wildcard is never consulted.
  it('reports a named group that blocks a bot the wildcard allows', () => {
    const result = run('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n');
    expect(result.status).toBe('warn');
    expect(result.message).toContain('GPTBot');
  });

  it('reaches the same verdict when the groups are written in the other order', () => {
    const result = run('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n');
    expect(result.status).toBe('warn');
    expect(result.message).toContain('GPTBot');
  });

  it('finds nothing when no AI token has a named group', () => {
    const result = run('User-agent: *\nAllow: /\nDisallow: /admin\n');
    expect(result.status).toBe('pass');
  });

  // Longest match wins, so the named group's Allow reopens a path the wildcard
  // closed — the protection is silently voided for that bot.
  it('fails when a longer Allow in the named group reopens a wildcard-disallowed path', () => {
    const result = run(
      'User-agent: *\nDisallow: /blog\n\nUser-agent: GPTBot\nDisallow: /blog\nAllow: /blog/2026\n',
      ['https://example.com/', 'https://example.com/blog/2026/x'],
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('/blog/2026');
  });

  // RFC 9309 §2.2.2: on equal pattern length, Allow wins.
  it('fails when an equal-length Allow ties with a Disallow in the named group', () => {
    const result = run(
      'User-agent: *\nDisallow: /reports\n\nUser-agent: ClaudeBot\nDisallow: /reports\nAllow: /reports\n',
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('/reports');
  });

  // A named group with no rules matches, obeys nothing, and the wildcard is
  // never read — so every wildcard Disallow evaporates for that bot.
  it('fails a named AI group that carries no Allow or Disallow rule at all', () => {
    const result = run('User-agent: *\nDisallow: /private\n\nUser-agent: PerplexityBot\nCrawl-delay: 10\n');
    expect(result.status).toBe('fail');
    expect(result.message).toContain('PerplexityBot');
  });

  it('passes when the named group matches the wildcard policy exactly', () => {
    const result = run('User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /admin\n');
    expect(result.status).toBe('pass');
  });

  it('reports the robots.txt as the finding location', () => {
    const result = run('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n');
    expect(result.found).toContain('GPTBot');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new RobotsAiGroupShadowingAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
