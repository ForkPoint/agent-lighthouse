import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { NoNofollowAudit } from './no-nofollow';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('NoNofollowAudit', () => {
  const audit = new NoNofollowAudit();

  const clean = '<html><head><meta name="robots" content="index, follow" /></head><body>Hi</body></html>';
  const nofollow = '<html><head><meta name="robots" content="nofollow" /></head><body>Hi</body></html>';

  it('passes when no pages have nofollow directives', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', clean)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No scanned pages have nofollow');
  });

  it('warns when some pages have nofollow directives', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', clean),
      mockPageContext('https://example.com/about', nofollow, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('have nofollow directives');
  });

  it('fails when all pages have nofollow directives', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', nofollow)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('have nofollow directives');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes on a page with no robots meta tag (covers ?? "" nullish fallback)', () => {
    // No <meta name="robots"> → page.meta['robots'] is undefined → ?? '' right branch
    const noMeta = '<html><head><title>Page</title></head><body>Content</body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', noMeta)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No scanned pages have nofollow');
  });

  it('shows "+N more" suffix when more than 5 pages have nofollow (warn path)', () => {
    // 1 clean page + 6 nofollow pages → not all have nofollow → warn, length > 5 → "+N more"
    const pages = [
      mockPageContext('https://example.com/', clean),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/page${i + 1}`, nofollow, i + 1),
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoNofollowAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(NoNofollowAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === NoNofollowAudit.meta.id)?.status).toBe('na');
  });

  // `requires` deliberately omits `rendered-body`: the meta tag and the header
  // this audit reads are served whole by a page whose body renders nothing.
  it('still judges a page that served no readable text', async () => {
    const result = await new NoNofollowAudit().audit(shellSiteContext());
    expect(result.status).not.toBe('na');
  });
});
