import { describe, it, expect } from 'vitest';
import { FastResponseTimeAudit } from './fast-response-time';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FastResponseTimeAudit', () => {
  const audit = new FastResponseTimeAudit();

  it('passes when TTFB is under 800ms', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.ttfbMs = 200;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('200ms');
  });

  it('fails when TTFB exceeds 800ms', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.ttfbMs = 1500;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('1500ms');
  });

  it('fails when the request errored', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.error = 'ETIMEDOUT';
    page.fetchResult.ttfbMs = 0;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('ETIMEDOUT');
  });

  it('fails when status is 0', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.status = 0;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('status 0');
  });

  it('warns when there is no homepage', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });
});
