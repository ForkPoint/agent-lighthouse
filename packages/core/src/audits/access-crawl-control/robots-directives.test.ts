import { describe, it, expect } from 'vitest';
import { MetaRobotsNotBlockingAudit } from './robots-directives';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body>Hi</body></html>`;

describe('MetaRobotsNotBlockingAudit', () => {
  const audit = new MetaRobotsNotBlockingAudit();

  it('passes when no scanned page carries a blocking directive', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="index, follow">')),
      mockPageContext('https://example.com/about', doc(''), 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2 page(s)');
  });

  it('fails at critical priority when the homepage is noindexed (absorbed 1.13)', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="noindex, follow">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.priority).toBe('critical');
    expect(result.found).toContain('https://example.com/');
  });

  it('fails at high priority when only an inner page is noindexed', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('')),
      mockPageContext('https://example.com/blog', doc('<meta name="robots" content="noindex">'), 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.priority).toBe('high');
    expect(result.found).toContain('https://example.com/blog');
  });

  // 4.20's highest-severity false pass: `content="none"` means noindex+nofollow.
  it('fails on content="none"', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="none">')),
    ]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  // Token matching, not substring: `noindexifembedded` is a much narrower directive.
  it('passes on noindexifembedded', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="robots" content="noindexifembedded">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('fails when noindex arrives only via the X-Robots-Tag header (absorbed 1.13)', () => {
    const page = mockPageContext('https://example.com/', doc(''));
    page.fetchResult.headers['x-robots-tag'] = 'noindex';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('X-Robots-Tag');
  });

  it('reads per-bot X-Robots-Tag syntax', () => {
    const page = mockPageContext('https://example.com/', doc(''));
    page.fetchResult.headers['x-robots-tag'] = 'googlebot: noindex';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('googlebot');
  });

  // 1.13's review: a per-bot header was read as a blanket noindex. A crawler
  // outside the allowlist binds nobody this audit reports on.
  it('ignores an X-Robots-Tag scoped to a bot outside the allowlist', () => {
    const page = mockPageContext('https://example.com/', doc(''));
    page.fetchResult.headers['x-robots-tag'] = 'yandexbot: noindex';
    expect(audit.audit(mockCheckContext([page])).status).toBe('pass');
  });

  it('still counts an X-Robots-Tag scoped to an AI crawler', () => {
    const page = mockPageContext('https://example.com/', doc(''));
    page.fetchResult.headers['x-robots-tag'] = 'gptbot: noindex';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('gptbot');
  });

  it('fails on a bot-specific noindex meta tag', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="GPTBot" content="noindex">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect((result.found ?? '').toLowerCase()).toContain('gptbot');
  });

  // extractMetaTags is last-wins; real crawlers apply the most restrictive tag.
  it('fails when a restrictive robots tag is followed by a permissive one', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="robots" content="noindex"><meta name="robots" content="index, follow">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('handles whitespace and case variants', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content=" NoIndex , NoFollow ">')),
    ]);
    expect(audit.audit(ctx).status).toBe('fail');
  });

  // 2.25 failed the whole site at high priority when a cart or login page was
  // scanned — noindex there is correct, not a defect.
  it('passes when only utility routes are noindexed, naming them', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('')),
      mockPageContext('https://example.com/cart', doc('<meta name="robots" content="noindex">'), 1),
      mockPageContext('https://example.com/login', doc('<meta name="robots" content="noindex">'), 2),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('utility');
  });

  it('warns when a content page permits indexing but forbids quoting', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="nosnippet">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('nosnippet');
  });

  it('warns on max-snippet:0', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="max-snippet:0">')),
    ]);
    expect(audit.audit(ctx).status).toBe('warn');
  });

  it('does not warn on a permissive max-snippet', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="robots" content="max-snippet:-1">')),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  // 4.20 reported a critical-priority PASS when every fetch had failed.
  it('is not-applicable when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('na');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new MetaRobotsNotBlockingAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
