import { describe, it, expect } from 'vitest';
import { CoreOpenGraphAudit } from './core-open-graph';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

const ALL_OG = `
  <meta property="og:title" content="Title">
  <meta property="og:description" content="Description">
  <meta property="og:image" content="https://example.com/i.png">
  <meta property="og:url" content="https://example.com/">
`;

describe('CoreOpenGraphAudit', () => {
  const audit = new CoreOpenGraphAudit();

  it('passes when all four core OG tags are present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(ALL_OG))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All core OG tags');
  });

  it('warns when some but not all OG tags are present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta property="og:title" content="Title"><meta property="og:url" content="https://example.com/">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:image');
  });

  it('fails when all OG tags are missing', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing OG tags');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
