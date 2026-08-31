import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
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
  // answered a 2xx as HTML from this host — and no page survived the
  // orchestrator's `status === 200 && body` filter. The connection is fine;
  // there is nothing behind it.
  it('warns about a missing document, not a TLS fault, when no page survived', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('carried no document');
    expect(result.message).not.toContain('TLS');
    expect(result.message).not.toContain('unknown');
  });

  // `origin-reachable` accepts any 2xx while the orchestrator admits a page
  // only at 200, so a homepage answering 204 reaches the same branch. The
  // audit never read that status, and it used to assert it was 200.
  it('names no status it did not read', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.found).not.toContain('200');
    expect(result.message).not.toContain('200');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new HttpsEnabledAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(HttpsEnabledAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === HttpsEnabledAudit.meta.id)?.status).toBe('na');
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
    const plan = planAudits(walledSiteContext(), defaultConfig);
    const result = plan.skipped.find((stub) => stub.id === HttpsEnabledAudit.meta.id);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(HttpsEnabledAudit.meta.id);
    expect(result?.status).toBe('na');
    expect(result?.explanation).not.toContain('TLS or server error');
  });
});
