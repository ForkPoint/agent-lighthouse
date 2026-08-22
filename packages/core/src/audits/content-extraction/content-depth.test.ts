import { describe, it, expect } from 'vitest';
import { ContentDepthAudit } from './content-depth';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const manyWords = Array.from({ length: 350 }, (_, i) => `word${i}`).join(' ');

describe('ContentDepthAudit', () => {
  const audit = new ContentDepthAudit();

  it('passes when all pages exceed 300 words', () => {
    const page = mockPageContext('https://example.com', `<html><body><p>${manyWords}</p></body></html>`);
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when the homepage is deep but a secondary page is thin', () => {
    const home = mockPageContext('https://example.com', `<html><body><p>${manyWords}</p></body></html>`);
    const thin = mockPageContext('https://example.com/x', '<html><body><p>Too short here.</p></body></html>');
    const result = audit.audit(mockCheckContext([home, thin]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Lowest:');
  });

  it('fails when the only page is thin', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>Just a few words.</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });

  it('passes when there are no pages (empty ctx.pages)', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
