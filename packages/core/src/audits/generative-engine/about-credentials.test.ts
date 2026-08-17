import { describe, it, expect } from 'vitest';
import { AboutCredentialsAudit } from './about-credentials';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AboutCredentialsAudit', () => {
  const audit = new AboutCredentialsAudit();

  it('passes when about page has 2+ credential keywords', async () => {
    const ctx = mockCheckContext([], {
      '/about/': mockFetchResult('Our team has years of experience in software.', 200, 'text/html'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('credential signals');
  });

  it('warns when about page has a single credential keyword', async () => {
    const ctx = mockCheckContext([], {
      '/about/': mockFetchResult('Meet our team.', 200, 'text/html'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('limited credential signals');
  });

  it('warns when about page lacks credential keywords', async () => {
    const ctx = mockCheckContext([], {
      '/about/': mockFetchResult('Hello world, a page about our company.', 200, 'text/html'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('lacks credential keywords');
  });

  it('fails when no about page is found', async () => {
    const result = await audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No about page found');
  });

  it('fetches about page when absent from rootFiles and passes with credentials', async () => {
    const ctx = mockCheckContext([], {});
    ctx.fetch = async ({ url }: { url: string }) => {
      if (url.includes('/about/')) {
        return mockFetchResult('Our team has years of experience in software.', 200, 'text/html');
      }
      return mockFetchResult('', 404);
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('credential signals');
  });

  it('continues to next path when fetch throws for a path', async () => {
    const ctx = mockCheckContext([], {});
    ctx.fetch = async ({ url }: { url: string }) => {
      if (url.includes('/about/')) throw new Error('Network error');
      if (url.includes('/about-us/')) {
        return mockFetchResult('Our team has years of experience.', 200, 'text/html');
      }
      return mockFetchResult('', 404);
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('uses /about-us/ from rootFiles when /about/ is absent', async () => {
    const ctx = mockCheckContext([], {
      '/about-us/': mockFetchResult('Our professional team has expertise in software.', 200, 'text/html'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
