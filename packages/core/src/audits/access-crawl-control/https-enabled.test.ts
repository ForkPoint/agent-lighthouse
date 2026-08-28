import { describe, it, expect } from 'vitest';
import { HttpsEnabledAudit } from './https-enabled';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
  walledSiteContext,
} from '../../__tests__/test-utils';

describe('HttpsEnabledAudit', () => {
  const audit = new HttpsEnabledAudit();

  it('passes when baseUrl is https and homepage returns 200', () => {
    const page = mockPageContext('https://example.com', '<html><body>Hi</body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('HTTPS');
  });

  // A non-200 page is not a state the scanner produces: the orchestrator
  // admits a page only on `status === 200 && body`, so the previous version of
  // this test hand-set a 500 on an admitted page and pinned a message about a
  // status no reachable input can carry.
  it('never sees a page carrying a non-200 status', () => {
    const page = mockPageContext('https://example.com', '<html><body>Hi</body></html>');
    expect(page.fetchResult.status).toBe(200);
  });

  it('fails when baseUrl is not https', () => {
    const page = mockPageContext('http://example.com', '<html><body>Hi</body></html>');
    const ctx = mockCheckContext([page]);
    ctx.baseUrl = 'http://example.com';
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not served over HTTPS');
  });

  // The only state that reaches the warn. Attribution holds — the homepage
  // answered 200 as HTML from this host — and no page survived the
  // orchestrator's `status === 200 && body` filter, which means the body was
  // empty. The connection is fine; there is nothing behind it.
  it('warns about an empty body, not a TLS fault, when no page survived', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('empty body');
    expect(result.message).not.toContain('TLS');
    expect(result.message).not.toContain('unknown');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new HttpsEnabledAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
  // Ordering: the scheme is a property of the request, provable with no
  // response at all, so a walled scan of an HTTP site still gets the fail.
  it('still fails a plain-HTTP site whose homepage never answered', () => {
    const ctx = walledSiteContext({ baseUrl: 'http://example.com' });
    const result = new HttpsEnabledAudit().audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not served over HTTPS');
  });

  // The old branch warned "Possible TLS or server error" whenever no 200
  // arrived. On a bot wall that named a fault that does not exist.
  it('does not invent a TLS fault on a walled HTTPS site', () => {
    const result = new HttpsEnabledAudit().audit(walledSiteContext());
    expect(result.status).toBe('na');
    expect(result.message).not.toContain('TLS or server error');
  });
});
