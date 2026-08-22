import { describe, it, expect } from 'vitest';
import { CanonicalLinksAudit } from './canonical';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const page = (url: string, head: string, index = 0) =>
  mockPageContext(url, `<html lang="en"><head>${head}</head><body>Hi</body></html>`, index);

const self = (url: string, index = 0) => page(url, `<link rel="canonical" href="${url}">`, index);

describe('CanonicalLinksAudit', () => {
  const audit = new CanonicalLinksAudit();

  it('passes when every page is self-referentially canonical', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      self('https://example.com/about', 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  // The failure mode the graded mechanism actually warns about: v1 scored it 1.0.
  it('fails when several pages collapse onto the homepage', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      page('https://example.com/about', '<link rel="canonical" href="https://example.com/">', 1),
      page('https://example.com/pricing', '<link rel="canonical" href="https://example.com/">', 2),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.priority).toBe('high');
    expect(result.message).toContain('homepage');
  });

  // Lower boundary of the non-root collapse threshold: one page pointing at a
  // genuinely different URL is ordinary pagination. Drop the threshold to 1 and
  // this test fails.
  it('does not report one page that legitimately canonicalizes elsewhere', () => {
    const ctx = mockCheckContext([
      self('https://example.com/blog'),
      page(
        'https://example.com/blog/page/2',
        '<link rel="canonical" href="https://example.com/blog">',
        1,
      ),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  // Lower boundary of the homepage-collapse threshold. Drop it to 1 and this
  // test fails.
  it('does not fail when exactly one page canonicalizes onto the homepage', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      page('https://example.com/about', '<link rel="canonical" href="https://example.com/">', 1),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  // The majority half of the non-root rule: 2 of 5 declaring pages is a pair of
  // variants, not a template bug.
  it('does not warn when a minority of declaring pages share a non-root target', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      page('https://example.com/a', '<link rel="canonical" href="https://example.com/hub">', 1),
      page('https://example.com/b', '<link rel="canonical" href="https://example.com/hub">', 2),
      self('https://example.com/c', 3),
      self('https://example.com/d', 4),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('warns when most pages collapse onto one non-root URL', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      page('https://example.com/a', '<link rel="canonical" href="https://example.com/hub">', 1),
      page('https://example.com/b', '<link rel="canonical" href="https://example.com/hub">', 2),
      page('https://example.com/c', '<link rel="canonical" href="https://example.com/hub">', 3),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('collapse');
  });

  it('matches rel case-insensitively and token-wise', () => {
    const ctx = mockCheckContext([
      page('https://example.com/', '<link rel=" Canonical " href="https://example.com/">'),
      page(
        'https://example.com/x',
        '<link rel="shortlink canonical" href="https://example.com/x">',
        1,
      ),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  // v1 warned on a relative canonical; resolving it against the page URL makes
  // it unambiguous, which is exactly what the rewrite header asks for.
  it('resolves a relative canonical against the page URL', () => {
    const ctx = mockCheckContext([page('https://example.com/page', '<link rel="canonical" href="/page">')]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('normalizes trailing slash and case when comparing to the page URL', () => {
    const ctx = mockCheckContext([
      page('https://example.com/Page/', '<link rel="canonical" href="https://www.example.com/Page">'),
    ]);
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('fails on a canonical that is not an http(s) URL', () => {
    const ctx = mockCheckContext([
      page('https://example.com/', '<link rel="canonical" href="javascript:void(0)">'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not a valid http');
  });

  it('warns on an off-domain canonical', () => {
    const ctx = mockCheckContext([
      self('https://example.com/'),
      page('https://example.com/post', '<link rel="canonical" href="https://medium.com/@x/post">', 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('another domain');
  });

  it('warns when one page carries two conflicting canonicals', () => {
    const ctx = mockCheckContext([
      page(
        'https://example.com/',
        '<link rel="canonical" href="https://example.com/"><link rel="canonical" href="https://example.com/other">',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('conflicting');
  });

  // Crawlers honour a canonical in <head> only.
  it('treats a body-only canonical as missing and says why', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        '<html lang="en"><head></head><body><link rel="canonical" href="https://example.com/"></body></html>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('outside <head>');
  });

  // Google: "your site will likely do just fine without specifying a canonical
  // preference" — absence is not a documented defect, so it no longer fails.
  it('warns rather than fails when no page has a canonical', () => {
    const ctx = mockCheckContext([page('https://example.com/', '')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.priority).toBe('medium');
  });

  it('warns at low priority when only some pages are missing a canonical', () => {
    const ctx = mockCheckContext([self('https://example.com/'), page('https://example.com/a', '', 1)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.priority).toBe('low');
  });

  it('is not-applicable when no pages were scanned', () => {
    expect(audit.audit(mockCheckContext([])).status).toBe('na');
  });
});
