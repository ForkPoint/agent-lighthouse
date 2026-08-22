import { describe, it, expect } from 'vitest';
import { ContentTypeOptionsAudit } from './content-type-options';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ContentTypeOptionsAudit', () => {
  const audit = new ContentTypeOptionsAudit();

  it('passes when set to nosniff', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['x-content-type-options'] = 'nosniff';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('nosniff');
  });

  it('warns when present but not nosniff', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['x-content-type-options'] = 'something-else';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not set to nosniff');
  });

  it('fails when header is missing', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Header not found');
  });

  it('fails when there are no pages (covers headers ?? {} branch)', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
