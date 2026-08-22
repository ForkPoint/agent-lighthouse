import { describe, it, expect } from 'vitest';
import { ServerRenderedAudit } from './server-rendered';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ServerRenderedAudit', () => {
  const audit = new ServerRenderedAudit();

  it('passes when the homepage has substantial text content', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const page = mockPageContext('https://example.com', `<html><body><main>${words}</main></body></html>`);
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('meaningful server-rendered content');
  });

  it('fails when the homepage has minimal content', () => {
    const page = mockPageContext('https://example.com', '<html><body><main>Hi</main></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('minimal server-rendered content');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });
});
