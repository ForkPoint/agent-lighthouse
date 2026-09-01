import { describe, it, expect } from 'vitest';
import { SensitivePathsAudit } from './sensitive-paths';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

/** Homepage carrying the given anchors, so the crawl "observes" those paths. */
function pageLinking(...hrefs: string[]) {
  const links = hrefs.map((h) => `<a href="${h}">link</a>`).join('');
  return mockPageContext('https://example.com/', `<html><body><nav>${links}</nav></body></html>`);
}

describe('SensitivePathsAudit', () => {
  const audit = new SensitivePathsAudit();

  it('is notApplicable when the crawl observes no low-value URL family', async () => {
    const ctx = mockCheckContext([pageLinking('/docs/intro', '/blog/hello')], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('never demands a Disallow for /api/ — agent surfaces are not low-value', async () => {
    const ctx = mockCheckContext([pageLinking('/api/v1/products', '/api/openapi.json')], {
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(JSON.stringify(result)).not.toContain('/api/');
  });

  it('passes when every observed low-value family is disallowed for AI crawlers', async () => {
    const robots = 'User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /search';
    const ctx = mockCheckContext([pageLinking('/cart', '/checkout', '/search?q=shoes')], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes a WordPress site on its own /wp-admin/ rule without demanding /admin/', async () => {
    const ctx = mockCheckContext([pageLinking('/wp-admin/', '/blog/post')], {
      '/robots.txt': mockFetchResult('User-agent: *\nDisallow: /wp-admin/', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when only some observed families are excluded', async () => {
    const ctx = mockCheckContext([pageLinking('/cart', '/search?q=x')], {
      '/robots.txt': mockFetchResult('User-agent: *\nDisallow: /cart', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
  });

  it('fails when robots.txt excludes none of the observed families', async () => {
    const ctx = mockCheckContext([pageLinking('/cart', '/checkout')], {
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.priority).toBe('low');
  });

  it('treats an empty `Disallow:` as protecting nothing (RFC 9309 §2.2.2)', async () => {
    const ctx = mockCheckContext([pageLinking('/cart')], {
      '/robots.txt': mockFetchResult('User-agent: *\nDisallow:', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('does not count a rule that applies to one bot only as full coverage', async () => {
    const ctx = mockCheckContext([pageLinking('/cart')], {
      '/robots.txt': mockFetchResult('User-agent: GPTBot\nDisallow: /cart', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).not.toBe('pass');
  });

  it('is notApplicable when the whole site is blanket-blocked', async () => {
    const ctx = mockCheckContext([pageLinking('/cart', '/checkout')], {
      '/robots.txt': mockFetchResult('User-agent: *\nDisallow: /', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('fails when robots.txt is missing but low-value URLs were observed', async () => {
    const ctx = mockCheckContext([pageLinking('/checkout')], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('no robots.txt');
  });

  it('discovers candidate paths from the sitemap as well as from links', async () => {
    const sitemap =
      '<?xml version="1.0"?><urlset><url><loc>https://example.com/account/orders</loc></url></urlset>';
    const ctx = mockCheckContext([pageLinking('/blog/post')], {
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
      '/sitemap.xml': mockFetchResult(sitemap, 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('account');
  });

  it('ignores cross-origin links when collecting candidates', async () => {
    const ctx = mockCheckContext([pageLinking('https://other.example.org/cart')], {
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('emits a fix rule that matches a locale-prefixed path, and applying it passes', async () => {
    const pages = [pageLinking('/en-gb/checkout', '/en-gb/cart')];
    const before = await audit.audit(
      mockCheckContext(pages, { '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200) }),
    );
    expect(before.status).toBe('fail');

    // A bare `Disallow: /checkout` would not match `/en-gb/checkout` under
    // RFC 9309, so the emitted rule has to carry the locale segment.
    const emitted = before.details?.code ?? '';
    expect(emitted).toContain('Disallow: /en-gb/checkout');
    expect(emitted).toContain('Disallow: /en-gb/cart');

    // Feed the audit's own recommendation back in as robots.txt.
    const after = await audit.audit(
      mockCheckContext(pages, { '/robots.txt': mockFetchResult(emitted, 200) }),
    );
    expect(after.status).toBe('pass');
  });

  it('emits one rule per locale rather than collapsing them to one family', async () => {
    const ctx = mockCheckContext([pageLinking('/en-gb/checkout', '/de/checkout')], {
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
    });
    const result = await audit.audit(ctx);
    const emitted = result.details?.code ?? '';
    expect(emitted).toContain('Disallow: /en-gb/checkout');
    expect(emitted).toContain('Disallow: /de/checkout');
  });

  it('emits a rule that makes a non-locale candidate pass too', async () => {
    const pages = [pageLinking('/search?q=shoes', '/account/orders')];
    const before = await audit.audit(mockCheckContext(pages, {}));
    expect(before.status).toBe('fail');

    const emitted = before.details?.code ?? '';
    const after = await audit.audit(
      mockCheckContext(pages, { '/robots.txt': mockFetchResult(emitted, 200) }),
    );
    expect(after.status).toBe('pass');
  });

  it('does not frame the finding as a security or privacy control', () => {
    const meta = SensitivePathsAudit.meta;
    const blob = JSON.stringify(meta).toLowerCase();
    expect(blob).not.toContain('security risk');
    expect(blob).not.toContain('privacy risk');
    expect(meta.defaultPriority).toBe('low');
    // The RFC 9309 caveat and the user-initiated-fetcher caveat must both be stated.
    expect(meta.guidance?.impact).toContain('not a substitute for valid content security measures');
    expect(meta.guidance?.impact).toMatch(/ChatGPT-User|Perplexity-User/);
  });
});

